import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/database/supabaseClient";
import { rowToProperty } from "@/lib/db";
import { listFinancialPayments } from "@/server/modules/financial/payment-responsibility.service";
import { withAuth } from "@/lib/auth";

async function _GET(request, context) {
  try {
    const supabase = getSupabaseClient();
    const { data: propRows, error: propErr } = await supabase
      .from("properties")
      .select("id,name,unit_count,max_people,current_people,observacoes,estimated_value,created_at,updated_at")
      .order("name", { ascending: true });
    if (propErr) throw propErr;

    const properties = (propRows || []).map(rowToProperty);

    let tenants = [];
    let payments = [];
    let units = [];
    let obraCostsByProperty = {};

    try {
      const { data: tenantRows, error: tenantErr } = await supabase
        .from("tenants")
        .select("id,property_id,rent_value")
        .eq("status", "ativo");
      if (tenantErr) throw tenantErr;
      tenants = tenantRows || [];
    } catch (_) {
      const { data: tenantRows2, error: tenantErr2 } = await supabase
        .from("tenants")
        .select("id,rent_value")
        .eq("status", "ativo");
      if (tenantErr2) throw tenantErr2;
      tenants = (tenantRows2 || []).map((r) => ({ id: r.id, property_id: null, rent_value: r.rent_value }));
    }

    try {
      payments = (await listFinancialPayments()).filter((payment) => Number(payment.amount) > 0);
    } catch (_) {}

    try {
      const { data: unitRows, error: unitErr } = await supabase
        .from("property_units")
        .select("id,property_id,rent_price,tenant_id");
      if (unitErr) throw unitErr;
      units = unitRows || [];
    } catch (_) {
      units = [];
    }

    try {
      const { data: obrasRows, error: obrasErr } = await supabase.from("obras").select("id,property_id");
      if (obrasErr) throw obrasErr;

      const propertyIdByObraId = {};
      (obrasRows || []).forEach((o) => {
        const pid = o.property_id;
        if (pid != null && String(pid) !== "") propertyIdByObraId[o.id] = String(pid);
      });

      const { data: costRows, error: costErr } = await supabase
        .from("obra_costs")
        .select("obra_id,value");
      if (costErr) throw costErr;

      (costRows || []).forEach((c) => {
        const pid = propertyIdByObraId[c.obra_id];
        if (!pid) return;
        obraCostsByProperty[pid] = (obraCostsByProperty[pid] || 0) + (Number(c.value) || 0);
      });
    } catch (_) {
      obraCostsByProperty = {};
    }

    const totalProperties = properties.length;
    const totalUnits = properties.reduce((s, p) => s + (p.unitCount || 0), 0);
    const totalMoradores = tenants.length;
    const totalMaxPeople = properties.reduce((s, p) => s + (p.maxPeople || 0), 0);
    const avgOccupancy = totalMaxPeople > 0
      ? Math.round((totalMoradores / totalMaxPeople) * 100)
      : 0;

    const tenantById = {};
    tenants.forEach((tenant) => {
      tenantById[tenant.id] = tenant;
    });

    const revenueByPropertyId = {};
    payments.forEach((p) => {
      const pid = tenantById[p.tenantId]?.property_id || "__none__";
      revenueByPropertyId[pid] = (revenueByPropertyId[pid] || 0) + (Number(p.amount) || 0);
    });

    // Monthly rent projection by property (sum of unit rents; fallback to tenant rent_value when unit rent_price missing)
    const tenantRentById = {};
    tenants.forEach((t) => { tenantRentById[t.id] = Number(t.rent_value) || 0; });
    const monthlyRentByPropertyId = {};
    units.forEach((u) => {
      const pid = u.property_id || "__none__";
      const unitRent = u.rent_price != null && u.rent_price !== "" && !isNaN(Number(u.rent_price)) ? Number(u.rent_price) : null;
      const fallbackRent = u.tenant_id ? (tenantRentById[u.tenant_id] || 0) : 0;
      const rent = unitRent != null ? unitRent : fallbackRent;
      monthlyRentByPropertyId[pid] = (monthlyRentByPropertyId[pid] || 0) + (Number(rent) || 0);
    });

    // Payoff months = obraCost / monthlyRent
    const payoffMonthsByPropertyId = {};
    properties.forEach((p) => {
      const cost = obraCostsByProperty[p.id] || 0;
      const rent = monthlyRentByPropertyId[p.id] || 0;
      payoffMonthsByPropertyId[p.id] = rent > 0 ? Math.ceil(cost / rent) : null;
    });

    let topPropertyByRevenue = null;
    let topRevenue = 0;
    properties.forEach((p) => {
      const rev = revenueByPropertyId[p.id] || 0;
      if (rev > topRevenue) {
        topRevenue = rev;
        topPropertyByRevenue = p.name;
      }
    });
    if (!topPropertyByRevenue && properties.length > 0) {
      topPropertyByRevenue = properties[0].name;
    }

    const valuationChart = properties.map((p) => ({
      name: p.name,
      value: p.estimatedValue ?? 0,
    }));

    const revenueByPropertyChart = properties.map((p) => ({
      name: p.name,
      total: revenueByPropertyId[p.id] || 0,
    }));

    const obraSpendByPropertyChart = properties.map((p) => ({
      name: p.name,
      total: obraCostsByProperty[p.id] || 0,
    }));

    const monthlyRentByPropertyChart = properties.map((p) => ({
      name: p.name,
      total: monthlyRentByPropertyId[p.id] || 0,
    }));

    const payoffMonthsByPropertyChart = properties.map((p) => ({
      name: p.name,
      months: payoffMonthsByPropertyId[p.id],
    }));

    const occupancyByPropertyChart = properties.map((p) => ({
      name: p.name,
      rate: (p.maxPeople && p.maxPeople > 0)
        ? Math.round(((p.currentPeople || 0) / p.maxPeople) * 100)
        : 0,
    }));

    const residentsDistributionChart = properties.map((p) => ({
      name: p.name,
      value: p.currentPeople || 0,
    }));

    const capacityVsOccupancyChart = properties.map((p) => ({
      name: p.name,
      capacidade: p.maxPeople || 0,
      ocupacao: p.currentPeople || 0,
    }));

    const valuationTimelineChart = properties.slice(0, 5).map((p) => ({
      name: p.name,
      valor: p.estimatedValue ?? 0,
    }));

    return NextResponse.json({
      stats: {
        totalProperties,
        totalUnits,
        totalMoradores,
        avgOccupancy,
        topPropertyByRevenue: topPropertyByRevenue || "—",
      },
      charts: {
        valuation: valuationChart,
        revenueByProperty: revenueByPropertyChart,
        obraSpendByProperty: obraSpendByPropertyChart,
        monthlyRentByProperty: monthlyRentByPropertyChart,
        payoffMonthsByProperty: payoffMonthsByPropertyChart,
        occupancyByProperty: occupancyByPropertyChart,
        residentsDistribution: residentsDistributionChart,
        capacityVsOccupancy: capacityVsOccupancyChart,
        valuationTimeline: valuationTimelineChart,
      },
    });
  } catch (err) {
    console.error("GET /api/properties/dashboard", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
