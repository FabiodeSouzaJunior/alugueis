import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/database/supabaseClient";
import { rowToNotification } from "@/lib/db";
import { withAuth } from "@/lib/auth";

async function _GET(request, context) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const includeUnreadCount = searchParams.get("includeUnreadCount") !== "false";
    const search = searchParams.get("search")?.trim() || "";
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 100);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    let query = supabase
      .from("notifications")
      .select("id,type,title,message,related_entity,related_id,link_href,created_at,read_at");
    if (type) query = query.eq("type", type);
    if (unreadOnly) query = query.is("read_at", null);
    if (search) {
      const like = `%${search}%`;
      query = query.or(`title.ilike.${like},message.ilike.${like}`);
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    const { data: rows, error } = await query;
    if (error) throw error;

    const list = (rows || []).map(rowToNotification);

    let unreadCount = null;
    if (includeUnreadCount) {
      const { count, error: countErr } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (countErr) throw countErr;
      unreadCount = count ?? 0;
    }

    return NextResponse.json({ notifications: list, unreadCount });
  } catch (err) {
    console.error("GET /api/notifications", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
