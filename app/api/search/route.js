import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/database/supabaseClient";
import { rowToTenant, rowToPayment, rowToObra, rowToExpense, rowToNotification } from "@/lib/db";
import { filterFinancialTenantIds } from "@/server/modules/financial/payment-responsibility.service";
import { withAuth } from "@/lib/auth";

const LIMIT = 5;

async function _GET(request, context) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    if (q.length < 2) {
      return NextResponse.json({ tenants: [], payments: [], obras: [], expenses: [], notifications: [] });
    }

    const like = `%${q.replace(/%/g, "\\%")}%`;
    const results = { tenants: [], payments: [], obras: [], expenses: [], notifications: [] };

    const tenantOr = `name.ilike.${like},kitnet_number.ilike.${like},phone.ilike.${like}`;
    const { data: tenantRows, error: tenantErr } = await supabase
      .from("tenants")
      .select("id,name,phone,kitnet_number,status,property_id,rent_value,start_date,is_payment_responsible")
      .or(tenantOr)
      .order("name", { ascending: true })
      .range(0, LIMIT - 1);
    if (tenantErr) throw tenantErr;
    results.tenants = (tenantRows || []).map(rowToTenant);

    const { data: obraRows, error: obraErr } = await supabase
      .from("obras")
      .select("id,name,status,start_date,end_date,budget,property_id")
      .or(`name.ilike.${like}`)
      .order("name", { ascending: true })
      .range(0, LIMIT - 1);
    if (obraErr) throw obraErr;
    results.obras = (obraRows || []).map(rowToObra);

    const expenseOr = `description.ilike.${like},type.ilike.${like}`;
    const { data: expenseRows, error: expenseErr } = await supabase
      .from("expenses")
      .select("id,type,value,date,description")
      .or(expenseOr)
      .order("date", { ascending: false })
      .range(0, LIMIT - 1);
    if (expenseErr) throw expenseErr;
    results.expenses = (expenseRows || []).map(rowToExpense);

    const notifOr = `title.ilike.${like},message.ilike.${like}`;
    const { data: notifRows, error: notifErr } = await supabase
      .from("notifications")
      .select("id,type,title,message,related_entity,related_id,link_href,created_at,read_at")
      .or(notifOr)
      .order("created_at", { ascending: false })
      .range(0, LIMIT - 1);
    if (notifErr) throw notifErr;
    results.notifications = (notifRows || []).map(rowToNotification);

    const tenantIds = (results.tenants || []).map((t) => t.id).filter(Boolean);
    const financialTenantIds = await filterFinancialTenantIds(tenantIds);
    if (financialTenantIds.length > 0) {
      const { data: paymentRows, error: paymentErr } = await supabase
        .from("payments")
        .select("id,tenant_id,month,year,due_date,payment_date,amount,expected_amount,status,created_at,updated_at")
        .in("tenant_id", financialTenantIds)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .order("due_date", { ascending: false })
        .range(0, LIMIT - 1);
      if (paymentErr) throw paymentErr;

      const tenantInfoById = {};
      (tenantRows || []).forEach((t) => {
        tenantInfoById[t.id] = t;
      });

      results.payments = (paymentRows || []).map((r) => {
        const p = rowToPayment(r);
        const t = tenantInfoById[r.tenant_id];
        p.tenantName = t?.name ?? null;
        p.kitnetNumber = t?.kitnet_number ?? null;
        return p;
      });
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("GET /api/search", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
