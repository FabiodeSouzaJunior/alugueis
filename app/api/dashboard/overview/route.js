import { NextResponse } from "next/server";

import {
  getDashboardNumbersYear,
  getPaymentRowData,
  getPaymentStatusDistribution,
  getPendingAmount,
} from "@/lib/calculations";
import { pool, rowToExpense, rowToNotification, rowToObra, rowToResidentEvaluation, rowToTenant, rowToTenantExit } from "@/lib/db";
import { listFinancialPayments } from "@/server/modules/financial/payment-responsibility.service";
import { withAuth } from "@/lib/auth";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const COST_CATEGORIES = ["Material", "Mão de obra", "Ferramentas", "Projeto", "Taxas", "Outros"];

function buildRevenueExpenseLineData(payments, expenses, year) {
  const byMonth = Array.from({ length: 12 }, (_, index) => ({
    name: MONTH_NAMES[index],
    receita: 0,
    despesas: 0,
    lucro: 0,
  }));

  (payments || []).forEach((payment) => {
    if (!payment.paymentDate) return;
    const paymentDate = new Date(payment.paymentDate);
    if (paymentDate.getFullYear() !== year) return;
    byMonth[paymentDate.getMonth()].receita += Number(payment.amount) || 0;
  });

  (expenses || []).forEach((expense) => {
    if (!expense.date) return;
    const expenseDate = new Date(expense.date);
    if (expenseDate.getFullYear() !== year) return;
    byMonth[expenseDate.getMonth()].despesas += Number(expense.value) || 0;
  });

  byMonth.forEach((row) => {
    row.lucro = row.receita - row.despesas;
  });

  return byMonth;
}

function buildCumulativeRevenueData(payments, year) {
  const byMonth = Array.from({ length: 12 }, (_, index) => ({
    name: MONTH_NAMES[index],
    acumulado: 0,
  }));

  (payments || []).forEach((payment) => {
    if (!payment.paymentDate) return;
    const paymentDate = new Date(payment.paymentDate);
    if (paymentDate.getFullYear() !== year) return;
    byMonth[paymentDate.getMonth()].acumulado += Number(payment.amount) || 0;
  });

  let running = 0;
  byMonth.forEach((row) => {
    running += row.acumulado;
    row.acumulado = running;
  });

  return byMonth;
}

function buildInadimplenciaTimelineData(payments) {
  const byPeriod = {};

  (payments || []).forEach((payment) => {
    const pending = getPendingAmount(payment);
    if (pending <= 0 || !payment.dueDate) return;
    const [year, month] = String(payment.dueDate).split("-").map(Number);
    if (!year || !month) return;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (!byPeriod[key]) {
      byPeriod[key] = {
        periodKey: key,
        label: `${String(month).padStart(2, "0")}/${year}`,
        value: 0,
      };
    }
    byPeriod[key].value += pending;
  });

  return Object.values(byPeriod)
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey))
    .slice(-24);
}

function buildTopDebtors(payments, tenants) {
  const tenantById = Object.fromEntries((tenants || []).map((tenant) => [tenant.id, tenant]));
  const byTenant = {};

  (payments || []).forEach((payment) => {
    const pending = getPendingAmount(payment);
    if (pending <= 0) return;

    const tenantId = payment.tenantId;
    if (!byTenant[tenantId]) {
      const tenant = tenantById[tenantId];
      byTenant[tenantId] = {
        tenantId,
        tenantName: tenant?.name ?? "-",
        kitnetNumber: tenant?.kitnetNumber ?? "-",
        totalPendente: 0,
        diasAtraso: null,
      };
    }

    byTenant[tenantId].totalPendente += pending;
    const row = getPaymentRowData(payment);
    if (row.diasAtraso != null) {
      byTenant[tenantId].diasAtraso = Math.max(byTenant[tenantId].diasAtraso ?? 0, row.diasAtraso);
    }
  });

  return Object.values(byTenant)
    .sort((a, b) => b.totalPendente - a.totalPendente)
    .slice(0, 10);
}

function buildProjectProgress(obras, obraCostsRows, obraStagesRows) {
  const costsByObraId = {};
  const stagesByObraId = {};

  (obraCostsRows || []).forEach((row) => {
    const obraId = row.obra_id;
    costsByObraId[obraId] = (costsByObraId[obraId] || 0) + (Number(row.value) || 0);
  });

  (obraStagesRows || []).forEach((row) => {
    const obraId = row.obra_id;
    if (!stagesByObraId[obraId]) {
      stagesByObraId[obraId] = { total: 0, completed: 0 };
    }
    stagesByObraId[obraId].total += 1;
    if (String(row.status || "").toLowerCase() === "concluída" || String(row.status || "").toLowerCase() === "concluida") {
      stagesByObraId[obraId].completed += 1;
    }
  });

  return (obras || []).map((obra) => {
    const stageInfo = stagesByObraId[obra.id] || { total: 0, completed: 0 };
    const progressPct = stageInfo.total > 0 ? Math.round((stageInfo.completed / stageInfo.total) * 100) : 0;
    return {
      id: obra.id,
      name: obra.name,
      status: obra.status,
      costTotal: costsByObraId[obra.id] || 0,
      progressPct,
    };
  });
}

function buildCostDistribution(obraCostsRows) {
  const totals = Object.fromEntries(COST_CATEGORIES.map((category) => [category, 0]));

  (obraCostsRows || []).forEach((row) => {
    const category = COST_CATEGORIES.includes(row.category) ? row.category : "Outros";
    totals[category] += Number(row.value) || 0;
  });

  return COST_CATEGORIES.map((category) => ({
    name: category,
    value: totals[category] || 0,
  }));
}

function buildAlerts({ overdueAmount, totalPending, unreadCount, activeMaintenance, activeObras, avgSatisfaction }) {
  const alerts = [];

  if (overdueAmount > 0) {
    alerts.push({
      id: "overdue-payments",
      title: "Pagamentos em atraso",
      description: "Existem parcelas vencidas precisando de acompanhamento.",
      severity: "error",
      href: "/inadimplentes",
    });
  }

  if (totalPending > 0) {
    alerts.push({
      id: "pending-payments",
      title: "Valores em aberto",
      description: "O financeiro ainda possui valores pendentes no período.",
      severity: "warning",
      href: "/pagamentos",
    });
  }

  if (activeMaintenance > 0) {
    alerts.push({
      id: "maintenance-open",
      title: "Manutenções em aberto",
      description: `${activeMaintenance} item(ns) aguardando conclusão.`,
      severity: "warning",
      href: "/manutencao",
    });
  }

  if (activeObras > 0) {
    alerts.push({
      id: "obras-active",
      title: "Obras em andamento",
      description: `${activeObras} obra(s) ainda estão em execução.`,
      severity: "info",
      href: "/obras",
    });
  }

  if (unreadCount > 0) {
    alerts.push({
      id: "notifications-unread",
      title: "Notificações não lidas",
      description: `${unreadCount} notificação(ões) ainda aguardam leitura.`,
      severity: "info",
      href: "/notifications",
    });
  }

  if (avgSatisfaction != null && avgSatisfaction < 3) {
    alerts.push({
      id: "low-satisfaction",
      title: "Satisfação baixa",
      description: "As últimas avaliações indicam experiência abaixo do esperado.",
      severity: "warning",
      href: "/crm",
    });
  }

  return alerts;
}

async function _GET(request, context) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = Number(searchParams.get("year")) || now.getFullYear();
    const month = Number(searchParams.get("month")) || now.getMonth() + 1;

    const [
      propertyRowsResult,
      tenantRowsResult,
      expenseRowsResult,
      obraRowsResult,
      obraCostsRowsResult,
      obraStagesRowsResult,
      maintenanceRowsResult,
      notificationRowsResult,
      tenantExitRowsResult,
      evaluationRowsResult,
      payments,
    ] = await Promise.all([
      pool.query("SELECT id, name, unit_count, max_people, current_people, estimated_value FROM properties ORDER BY name ASC"),
      pool.query("SELECT id, name, kitnet_number, rent_value, start_date, status FROM tenants ORDER BY name ASC"),
      pool.query("SELECT id, type, value, date, description FROM expenses ORDER BY date DESC"),
      pool.query("SELECT id, property_id, name, budget, start_date, end_date, status, area_m2, created_at, updated_at FROM obras ORDER BY created_at DESC"),
      pool.query("SELECT obra_id, category, value FROM obra_costs"),
      pool.query("SELECT obra_id, status FROM obra_stages"),
      pool.query("SELECT id, type, location, status, created_at FROM maintenance ORDER BY created_at DESC"),
      pool.query("SELECT id, type, title, message, link_href, created_at, read_at FROM notifications ORDER BY created_at DESC LIMIT 10"),
      pool.query("SELECT tenant_id, exit_date, reason_code, notes FROM tenant_exits ORDER BY exit_date DESC"),
      pool.query("SELECT id, kitnet_number, overall_rating, created_at FROM resident_evaluations ORDER BY created_at DESC"),
      listFinancialPayments(),
    ]);

    const propertyRows = propertyRowsResult?.[0] || [];
    const tenantRows = tenantRowsResult?.[0] || [];
    const expenseRows = expenseRowsResult?.[0] || [];
    const obraRows = obraRowsResult?.[0] || [];
    const obraCostsRows = obraCostsRowsResult?.[0] || [];
    const obraStagesRows = obraStagesRowsResult?.[0] || [];
    const maintenanceRows = maintenanceRowsResult?.[0] || [];
    const notificationRows = notificationRowsResult?.[0] || [];
    const tenantExitRows = tenantExitRowsResult?.[0] || [];
    const evaluationRows = evaluationRowsResult?.[0] || [];

    const properties = propertyRows.map((row) => ({
      id: row.id,
      name: row.name,
      unitCount: Number(row.unit_count) || 0,
      maxPeople: Number(row.max_people) || 0,
      currentPeople: Number(row.current_people) || 0,
      estimatedValue: row.estimated_value != null ? Number(row.estimated_value) : 0,
    }));
    const tenants = tenantRows.map(rowToTenant);
    const expenses = expenseRows.map(rowToExpense);
    const obras = obraRows.map(rowToObra);
    const notifications = notificationRows.map(rowToNotification);
    const exits = tenantExitRows.map(rowToTenantExit);
    const evaluations = evaluationRows.map(rowToResidentEvaluation);

    const declaredUnits = properties.reduce((sum, property) => sum + (property.unitCount || 0), 0);
    const activeTenants = tenants.filter((tenant) => tenant.status === "ativo");
    const totalKitnets = Math.max(declaredUnits, activeTenants.length);
    const occupied = activeTenants.length;
    const empty = Math.max(0, totalKitnets - occupied);
    const occupancyRate = totalKitnets > 0 ? Math.round((occupied / totalKitnets) * 100) : 0;

    const statsYear = getDashboardNumbersYear(activeTenants, payments, expenses, year);
    const statusDistribution = getPaymentStatusDistribution(
      (payments || []).filter((payment) => Number(payment.year) === Number(year))
    );
    const topDebtors = buildTopDebtors(payments, tenants);
    const totalPending = topDebtors.reduce((sum, item) => sum + item.totalPendente, 0);
    const overdueAmount = topDebtors
      .filter((item) => (item.diasAtraso ?? 0) > 0)
      .reduce((sum, item) => sum + item.totalPendente, 0);

    const projectProgress = buildProjectProgress(obras, obraCostsRows, obraStagesRows);
    const costDistribution = buildCostDistribution(obraCostsRows);
    const unreadCount = notifications.filter((notification) => !notification.readAt).length;
    const activeMaintenance = maintenanceRows.filter((row) => String(row.status || "").toLowerCase() !== "concluido").length;
    const activeObras = obras.filter((obra) => String(obra.status || "").toLowerCase() !== "concluída" && String(obra.status || "").toLowerCase() !== "concluida").length;
    const completedObras = obras.length - activeObras;

    const startOfCurrentMonth = new Date(year, month - 1, 1);
    const endOfCurrentMonth = new Date(year, month, 1);
    const newThisMonth = activeTenants.filter((tenant) => {
      if (!tenant.startDate) return false;
      const startDate = new Date(tenant.startDate);
      return startDate >= startOfCurrentMonth && startDate < endOfCurrentMonth;
    }).length;
    const exitsThisMonth = exits.filter((exit) => {
      if (!exit.exitDate) return false;
      const exitDate = new Date(exit.exitDate);
      return exitDate >= startOfCurrentMonth && exitDate < endOfCurrentMonth;
    }).length;
    const satisfactionValues = evaluations
      .map((evaluation) => evaluation.overallRating)
      .filter((value) => value != null && !Number.isNaN(value));
    const avgSatisfaction = satisfactionValues.length
      ? Math.round((satisfactionValues.reduce((sum, value) => sum + value, 0) / satisfactionValues.length) * 100) / 100
      : null;

    const alerts = buildAlerts({
      overdueAmount,
      totalPending,
      unreadCount,
      activeMaintenance,
      activeObras,
      avgSatisfaction,
    });

    const activity = notifications.map((notification) => ({
      id: notification.id,
      type:
        notification.relatedEntity === "expense"
          ? "expense"
          : notification.relatedEntity === "maintenance"
            ? "expense"
            : notification.relatedEntity === "tenant"
              ? "tenant"
              : notification.relatedEntity === "obra"
                ? "obra"
                : "payment",
      title: notification.title,
      detail: notification.message,
      date: notification.createdAt,
      href: notification.linkHref,
      value: null,
    }));

    return NextResponse.json({
      period: { month, year },
      generatedAt: new Date().toISOString(),
      stats: {
        totalKitnets,
        occupied,
        empty,
        occupancyRate,
        expectedRevenue: statsYear.expectedRevenue,
        receivedRevenue: statsYear.receivedRevenue,
        overdueAmount,
        totalPending,
        totalExpenses: statsYear.totalExpenses,
        profit: statsYear.profit,
        totalObras: obras.length,
        activeObras,
        completedObras,
        activeMaintenance,
        unreadNotifications: unreadCount,
        avgSatisfaction,
        newThisMonth,
        exitsThisMonth,
      },
      financial: {
        statusDistribution,
        revenueExpenseLine: buildRevenueExpenseLineData(payments, expenses, year),
        cumulativeRevenue: buildCumulativeRevenueData(payments, year),
        revenueProgress: {
          receitaPrevista: statsYear.expectedRevenue,
          receitaRecebida: statsYear.receivedRevenue,
          valorAberto: totalPending,
        },
        inadimplenciaTimeline: buildInadimplenciaTimelineData(payments),
        topDebtors,
      },
      works: {
        costDistribution,
        projects: projectProgress,
      },
      occupancy: {
        occupied,
        empty,
      },
      crm: {
        avgSatisfaction,
        newThisMonth,
        exitsThisMonth,
      },
      notifications: {
        unreadCount,
        recent: notifications,
      },
      alerts,
      activity,
    });
  } catch (error) {
    console.error("GET /api/dashboard/overview", error);
    return NextResponse.json(
      { error: error.message || "Erro ao carregar o dashboard." },
      { status: 500 }
    );
  }
}

export const GET = withAuth(_GET);
