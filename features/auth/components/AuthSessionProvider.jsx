"use client";

import * as React from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase-browser";

const AuthSessionContext = React.createContext({
  status: "loading",
  session: null,
  user: null,
});

export function AuthSessionProvider({ children }) {
  const supabase = React.useMemo(() => getBrowserSupabaseClient(), []);
  const [state, setState] = React.useState({
    status: "loading",
    session: null,
    user: null,
  });

  React.useEffect(() => {
    let cancelled = false;
    let subscription = null;

    async function init() {
      if (!supabase) {
        if (!cancelled) {
          setState({ status: "unauthenticated", session: null, user: null });
        }
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;

        const session = error ? null : data?.session ?? null;
        setState({
          status: session?.user ? "authenticated" : "unauthenticated",
          session,
          user: session?.user ?? null,
        });
      } catch (_) {
        if (!cancelled) {
          setState({ status: "unauthenticated", session: null, user: null });
        }
      }

      const authSubscription = supabase.auth.onAuthStateChange((_event, session) => {
        if (cancelled) return;
        setState({
          status: session?.user ? "authenticated" : "unauthenticated",
          session: session ?? null,
          user: session?.user ?? null,
        });
      });

      subscription = authSubscription?.data?.subscription ?? null;
    }

    init();

    return () => {
      cancelled = true;
      subscription?.unsubscribe?.();
    };
  }, [supabase]);

  return (
    <AuthSessionContext.Provider value={state}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  return React.useContext(AuthSessionContext);
}
