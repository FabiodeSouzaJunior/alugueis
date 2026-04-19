"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const SHORTCUTS = {
  "mod+k": { action: "openSearch" },
  n: { action: "navigate", href: "/inquilinos" },
  p: { action: "navigate", href: "/pagamentos" },
  d: { action: "navigate", href: "/despesas" },
  o: { action: "navigate", href: "/obras" },
  m: { action: "navigate", href: "/manutencao" },
};

function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName?.toUpperCase();
  const role = el.getAttribute?.("role");
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    role === "textbox" ||
    el.isContentEditable
  );
}

export function KeyboardShortcutsProvider({ onOpenSearch, children }) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e) {
      const mod = e.ctrlKey || e.metaKey;
      if (e.key?.toLowerCase() === "k" && mod) {
        e.preventDefault();
        onOpenSearch?.(true);
        return;
      }
      if (isInputFocused()) return;
      if (mod || e.altKey) return;
      const key = e.key?.toLowerCase();
      const config = SHORTCUTS[key];
      if (!config) return;
      if (config.action === "openSearch") {
        e.preventDefault();
        onOpenSearch?.(true);
      } else if (config.action === "navigate" && config.href) {
        e.preventDefault();
        router.push(config.href);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenSearch, router]);

  return children;
}
