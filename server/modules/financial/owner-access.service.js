import { getServiceRoleClient, getSupabaseClient } from "@/database/supabaseClient";

async function readOwnerLinks(supabase, userId, organizationId) {
  const { data, error } = await supabase
    .from("owner_user_links")
    .select("owner_id, organization_id, active")
    .eq("user_id", userId)
    .eq("active", true);

  if (error) {
    const message = String(error.message || "");
    if (/owner_user_links/i.test(message) || error.code === "42P01") {
      return [];
    }
    throw error;
  }

  return (data || [])
    .filter((row) => !organizationId || row.organization_id === organizationId)
    .map((row) => row.owner_id)
    .filter(Boolean);
}

export async function listOwnerIdsForUser(userId, organizationId) {
  if (!userId) return [];
  const supabase = getServiceRoleClient();
  const ownerIds = await readOwnerLinks(supabase, userId, organizationId);
  return Array.from(new Set(ownerIds.map((id) => String(id).trim()).filter(Boolean)));
}

export async function listCurrentOwnerIdsFromUserClient() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("current_owner_ids");
  if (error) {
    const message = String(error.message || "");
    if (/current_owner_ids/i.test(message) || error.code === "42883") {
      return [];
    }
    throw error;
  }

  const ownerIds = Array.isArray(data) ? data : [];
  return ownerIds.map((id) => String(id).trim()).filter(Boolean);
}
