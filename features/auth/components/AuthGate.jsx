"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useAuthSession } from "./AuthSessionProvider";

function SupabaseAuthGateFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-border/60 bg-card/70 p-6 text-center">
        <p className="text-sm text-muted-foreground">Carregando sessão...</p>
      </div>
    </div>
  );
}

export default function AuthGate({ children }) {
  const router = useRouter();
  const { status } = useAuthSession();

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  if (status === "loading") return <SupabaseAuthGateFallback />;
  if (status === "unauthenticated") return null;

  return children;
}
