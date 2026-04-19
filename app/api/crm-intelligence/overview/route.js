import { NextResponse } from "next/server";
import { pool, rowToTenant, rowToTenantExit, rowToResidentEvaluation } from "@/lib/db";
import { listFinancialPayments } from "@/server/modules/financial/payment-responsibility.service";
import { withAuth } from "@/lib/auth";

const TOTAL_KITNETS = 12;

function startOfMonth(d) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function _GET(request, context) {
  try {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = new Date(currentMonthStart);
    currentMonthEnd.setMonth(currentMonthEnd.getMonth() + 1);

    const [tenantsRows] = await pool.query(
      "SELECT id, name, kitnet_number, start_date, status FROM tenants ORDER BY start_date ASC"
    );
    const [exitsRows] = await pool.query(
      "SELECT tenant_id, exit_date, reason_code, notes FROM tenant_exits ORDER BY exit_date ASC"
    );
    const [evaluationsRows] = await pool.query(
      "SELECT id, tenant_name, contact, kitnet_number, overall_rating, comfort_rating, cleanliness_rating, infrastructure_rating, location_rating, cost_benefit_rating, recommendation, comment, categories, created_at FROM resident_evaluations ORDER BY created_at DESC"
    );
    const [interactionsRows] = await pool.query(
      "SELECT type FROM tenant_interactions"
    );
    const paymentsRows = await listFinancialPayments();

    const tenants = (tenantsRows || []).map(rowToTenant);
    const activeTenants = tenants.filter((t) => t.status === "ativo");
    const occupied = activeTenants.length;
    const occupancyRate = TOTAL_KITNETS ? Math.round((occupied / TOTAL_KITNETS) * 100) : 0;

    const newThisMonth = tenants.filter((t) => {
      const start = t.startDate ? new Date(t.startDate) : null;
      return start && start >= currentMonthStart && start < currentMonthEnd;
    }).length;

    const exits = (exitsRows || []).map(rowToTenantExit);
    const exitsThisMonth = exits.filter((e) => {
      const d = e.exitDate ? new Date(e.exitDate) : null;
      return d && d >= currentMonthStart && d < currentMonthEnd;
    }).length;

    const cy = now.getFullYear();
    const yearStart = new Date(cy, 0, 1);
    const yearEnd = new Date(cy + 1, 0, 1);
    const newThisYear = tenants.filter((t) => {
      const start = t.startDate ? new Date(t.startDate) : null;
      return start && start >= yearStart && start < yearEnd;
    }).length;
    const exitsThisYear = exits.filter((e) => {
      const d = e.exitDate ? new Date(e.exitDate) : null;
      return d && d >= yearStart && d < yearEnd;
    }).length;

    function monthsBetween(start, end) {
      if (!start || !end) return 0;
      const a = new Date(start);
      const b = new Date(end);
      return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
    }
    const tenures = activeTenants
      .map((t) => monthsBetween(t.startDate, now))
      .filter((m) => m >= 0);
    const avgTenureMonths = tenures.length ? Math.round((tenures.reduce((a, b) => a + b, 0) / tenures.length) * 10) / 10 : 0;

    const renovationCount = (interactionsRows || []).filter((r) => (r.type || "").toLowerCase().includes("renovação") || (r.type || "").toLowerCase().includes("renovacao")).length;
    const renewalRate = activeTenants.length ? Math.min(100, Math.round((renovationCount / Math.max(activeTenants.length, 1)) * 100)) : 0;

    const evaluations = (evaluationsRows || []).map(rowToResidentEvaluation);
    const satisfactionByTenant = new Map();
    evaluations.forEach((e) => {
      const key = e.kitnetNumber || e.id;
      if (!satisfactionByTenant.has(key)) {
        satisfactionByTenant.set(key, {
          overall: e.overallRating,
          comfort: e.comfortRating,
          cleanliness: e.cleanlinessRating,
          infrastructure: e.infrastructureRating,
          location: e.locationRating,
          costBenefit: e.costBenefitRating,
        });
      }
    });
    const satisfactionValues = evaluations.map((e) => e.overallRating).filter((v) => v != null && !isNaN(v));
    const avgSatisfaction = satisfactionValues.length ? Math.round((satisfactionValues.reduce((a, b) => a + b, 0) / satisfactionValues.length) * 100) / 100 : null;
    const satThisYear = evaluations
      .filter((e) => {
        if (e.overallRating == null || isNaN(e.overallRating) || !e.createdAt) return false;
        return new Date(e.createdAt).getFullYear() === cy;
      })
      .map((e) => e.overallRating);
    const avgSatisfactionYear = satThisYear.length
      ? Math.round((satThisYear.reduce((a, b) => a + b, 0) / satThisYear.length) * 100) / 100
      : null;

    const last12 = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last12.push(monthKey(d));
    }
    const entriesByMonth = {};
    const exitsByMonth = {};
    last12.forEach((k) => {
      entriesByMonth[k] = 0;
      exitsByMonth[k] = 0;
    });
    tenants.forEach((t) => {
      if (t.startDate) {
        const k = monthKey(t.startDate);
        if (entriesByMonth[k] !== undefined) entriesByMonth[k]++;
      }
    });
    exits.forEach((e) => {
      if (e.exitDate) {
        const k = monthKey(e.exitDate);
        if (exitsByMonth[k] !== undefined) exitsByMonth[k]++;
      }
    });

    const exitReasonsCount = {};
    exits.forEach((e) => {
      const r = e.reasonCode || "outro";
      exitReasonsCount[r] = (exitReasonsCount[r] || 0) + 1;
    });

    const feedbackByCategory = {};
    evaluations.forEach((e) => {
      const cats = Array.isArray(e.categories) ? e.categories : [];
      if (cats.length === 0) feedbackByCategory["Outro"] = (feedbackByCategory["Outro"] || 0) + 1;
      cats.forEach((cat) => {
        const c = cat || "Outro";
        feedbackByCategory[c] = (feedbackByCategory[c] || 0) + 1;
      });
    });

    const today = now.toISOString().split("T")[0];
    const overdueCount = (paymentsRows || []).filter((p) => {
      const due = p.dueDate ? String(p.dueDate).slice(0, 10) : "";
      const paid = Number(p.amount) || 0;
      const expected = Number(p.expectedAmount ?? p.amount) || 0;
      return due && due < today && paid < expected;
    }).length;

    const lowSatisfactionTenants = [...satisfactionByTenant.entries()]
      .filter(([, s]) => s.overall != null && s.overall < 3)
      .map(([key]) => key);

    const alerts = [];
    if (lowSatisfactionTenants.length > 0) {
      alerts.push({ type: "low_satisfaction", message: `${lowSatisfactionTenants.length} inquilino(s) com satisfação baixa`, count: lowSatisfactionTenants.length });
    }
    if (exitsThisMonth > 2) {
      alerts.push({ type: "high_exits", message: `${exitsThisMonth} saídas neste mês`, count: exitsThisMonth });
    }
    if (TOTAL_KITNETS - occupied > 3) {
      alerts.push({ type: "high_vacancy", message: `${TOTAL_KITNETS - occupied} unidades vazias`, count: TOTAL_KITNETS - occupied });
    }
    if (overdueCount > 0) {
      alerts.push({ type: "overdue", message: `${overdueCount} pagamento(s) em atraso`, count: overdueCount });
    }

    const satisfactionOverTime = [];
    const byMonthSat = new Map();
    evaluations.forEach((e) => {
      const overall = e.overallRating;
      if (overall == null) return;
      const k = e.createdAt ? monthKey(e.createdAt) : null;
      if (!k) return;
      if (!byMonthSat.has(k)) byMonthSat.set(k, []);
      byMonthSat.get(k).push(overall);
    });
    last12.forEach((k) => {
      const arr = byMonthSat.get(k) || [];
      const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      satisfactionOverTime.push({ month: k, average: avg != null ? Math.round(avg * 100) / 100 : null, count: arr.length });
    });

    return NextResponse.json({
      totalKitnets: TOTAL_KITNETS,
      activeTenants: activeTenants.length,
      occupied,
      empty: TOTAL_KITNETS - occupied,
      occupancyRate,
      avgTenureMonths,
      renewalRate,
      renovationCount,
      exitsThisMonth,
      newThisMonth,
      newThisYear,
      exitsThisYear,
      avgSatisfaction,
      avgSatisfactionYear,
      satisfactionByTenant: Object.fromEntries(satisfactionByTenant),
      entriesByMonth: last12.map((m) => ({ month: m, count: entriesByMonth[m] || 0 })),
      exitsByMonth: last12.map((m) => ({ month: m, count: exitsByMonth[m] || 0 })),
      exitReasonsCount,
      feedbackByCategory,
      satisfactionOverTime,
      alerts,
      lowSatisfactionTenantIds: lowSatisfactionTenants,
      overduePaymentsCount: overdueCount,
    });
  } catch (err) {
    console.error("GET /api/crm-intelligence/overview", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
