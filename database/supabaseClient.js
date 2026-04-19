import { createClient } from "@supabase/supabase-js";
import { AsyncLocalStorage } from "node:async_hooks";

const requestContext = new AsyncLocalStorage();
let serviceClient = null;

/**
 * Returns a service-role Supabase client (bypasses RLS).
 * Use ONLY for admin operations: creating users, password resets, etc.
 */
export function getServiceRoleClient() {
  if (serviceClient) return serviceClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseKey = serviceRoleKey || anonKey;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  if (!supabaseKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured");

  serviceClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return serviceClient;
}

/**
 * Returns the Supabase client for the current context.
 * - Inside a runWithUserToken() scope: returns a user-scoped client (RLS enforced).
 * - Outside: returns the service-role client (for auth routes, migrations, etc.).
 */
export function getSupabaseClient() {
  const ctx = requestContext.getStore();
  if (ctx?.userClient) return ctx.userClient;
  return getServiceRoleClient();
}

/**
 * Runs a function with a user-scoped Supabase client that respects RLS.
 * All calls to getSupabaseClient() inside the callback will return the user-scoped client.
 */
export function runWithUserToken(token, fn) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  return requestContext.run({ userClient }, fn);
}

