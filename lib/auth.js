import { createClient } from "@supabase/supabase-js";
import { getServiceRoleClient, runWithUserToken } from "@/database/supabaseClient";
import { listOwnerIdsForUser } from "@/server/modules/financial/owner-access.service";
import { NextResponse } from "next/server";

/**
 * Validates the Authorization header and resolves the user's organization_id
 * from the memberships table.
 *
 * Returns: { userId, organizationId, organizationRole, isOrgAdmin, ownerIds, token, error, status }
 */
export async function authenticateRequest(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return { userId: null, organizationId: null, token: null, error: "Token de autenticação ausente", status: 401 };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return { userId: null, organizationId: null, token: null, error: "Configuração do Supabase ausente", status: 500 };
  }

  // Create a client scoped to this user's token — NOT service role
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();

  if (authError || !user?.id) {
    return { userId: null, organizationId: null, token: null, error: "Token inválido ou expirado", status: 401 };
  }

  // Resolve organization_id from memberships using service role
  const supabase = getServiceRoleClient();
  const { data: membership, error: memError } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (memError || !membership?.organization_id) {
    return { userId: user.id, organizationId: null, token, error: "Usuário sem organização vinculada", status: 403 };
  }

  let ownerIds = [];
  try {
    ownerIds = await listOwnerIdsForUser(user.id, membership.organization_id);
  } catch (ownerError) {
    console.error("authenticateRequest owner resolution error:", ownerError);
    ownerIds = [];
  }

  const organizationRole = membership.role || null;
  const isOrgAdmin = organizationRole === "admin" || organizationRole === "manager";

  return {
    userId: user.id,
    organizationId: membership.organization_id,
    organizationRole,
    isOrgAdmin,
    ownerIds,
    email: user.email || null,
    token,
    error: null,
    status: null,
  };
}

/**
 * Wraps an API route handler with authentication and user-scoped DB access.
 * All getSupabaseClient() and pool.query calls inside will use the user's JWT (RLS enforced).
 */
export function withAuth(handler) {
  return async (request, context) => {
    const auth = await authenticateRequest(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    request.auth = auth;
    return runWithUserToken(auth.token, () => handler(request, context));
  };
}
