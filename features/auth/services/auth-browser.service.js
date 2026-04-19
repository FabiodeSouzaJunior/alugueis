"use client";

import { getBrowserSupabaseClient } from "@/lib/supabase-browser";

function getSupabaseOrThrow() {
  const supabase = getBrowserSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase keys não configuradas no cliente");
  }

  return supabase;
}

function clearRecoveryHash() {
  if (typeof window === "undefined" || !window.location.hash) return;

  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

function readRecoveryTokensFromHash() {
  if (typeof window === "undefined") {
    return {
      accessToken: "",
      refreshToken: "",
      type: "",
    };
  }

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);

  return {
    accessToken: String(params.get("access_token") || ""),
    refreshToken: String(params.get("refresh_token") || ""),
    type: String(params.get("type") || ""),
  };
}

export async function setBrowserSession({ access_token, refresh_token }) {
  const supabase = getSupabaseOrThrow();
  const result = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  if (result.error) {
    throw new Error(result.error.message || "Falha ao iniciar sessão");
  }

  return result.data.session;
}

export async function getBrowserSession() {
  const supabase = getSupabaseOrThrow();
  const result = await supabase.auth.getSession();

  if (result.error) {
    throw new Error(result.error.message || "Falha ao recuperar sessão");
  }

  return result.data.session || null;
}

export async function initializeRecoverySession() {
  const supabase = getSupabaseOrThrow();
  const recoveryTokens = readRecoveryTokensFromHash();

  if (
    recoveryTokens.type === "recovery" &&
    recoveryTokens.accessToken &&
    recoveryTokens.refreshToken
  ) {
    const sessionResult = await supabase.auth.setSession({
      access_token: recoveryTokens.accessToken,
      refresh_token: recoveryTokens.refreshToken,
    });

    if (sessionResult.error) {
      throw new Error(sessionResult.error.message || "Link de recuperação inválido ou expirado");
    }

    clearRecoveryHash();
  }

  const userResult = await supabase.auth.getUser();

  if (userResult.error || !userResult.data?.user?.email) {
    throw new Error("Link de recuperação inválido ou expirado");
  }

  const sessionResult = await supabase.auth.getSession();

  if (sessionResult.error || !sessionResult.data?.session) {
    throw new Error("Sessão de recuperação inválida ou expirada");
  }

  return {
    user: userResult.data.user,
    session: sessionResult.data.session,
  };
}

export async function signOutBrowserSession() {
  const supabase = getSupabaseOrThrow();
  await supabase.auth.signOut();
}
