"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Users,
  CreditCard,
  HardHat,
  Receipt,
  Bell,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 280;

export function GlobalSearch({ open, onOpenChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const router = useRouter();

  const runSearch = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setResults({ tenants: [], payments: [], obras: [], expenses: [], notifications: [] });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data);
    } catch {
      setResults({ tenants: [], payments: [], obras: [], expenses: [], notifications: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = useCallback(
    (href) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router]
  );

  const r = results || {
    tenants: [],
    payments: [],
    obras: [],
    expenses: [],
    notifications: [],
  };
  const hasAny =
    r.tenants?.length > 0 ||
    r.payments?.length > 0 ||
    r.obras?.length > 0 ||
    r.expenses?.length > 0 ||
    r.notifications?.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="flex items-center border-b border-border px-3">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar inquilinos, pagamentos, obras, despesas, notificações..."
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            autoComplete="off"
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query.length >= 2 && !loading && !hasAny && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum resultado encontrado.</p>
          )}
          {query.length < 2 && open && (
            <p className="py-8 text-center text-sm text-muted-foreground">Digite ao menos 2 caracteres.</p>
          )}
          {hasAny && (
            <div className="space-y-4">
              {r.tenants?.length > 0 && (
                <section>
                  <p className="mb-1.5 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> Inquilinos
                  </p>
                  <ul className="space-y-0.5">
                    {r.tenants.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect("/inquilinos")}
                          className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="truncate">{t.name}</span>
                          <span className="text-muted-foreground">Kitnet {t.kitnetNumber ?? "-"}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {r.payments?.length > 0 && (
                <section>
                  <p className="mb-1.5 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <CreditCard className="h-3.5 w-3.5" /> Pagamentos
                  </p>
                  <ul className="space-y-0.5">
                    {r.payments.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect("/pagamentos")}
                          className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="truncate">{formatCurrency(p.amount)} · {p.tenantName ?? "-"}</span>
                          <span className="text-muted-foreground">{p.year}/{p.month}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {r.obras?.length > 0 && (
                <section>
                  <p className="mb-1.5 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <HardHat className="h-3.5 w-3.5" /> Obras
                  </p>
                  <ul className="space-y-0.5">
                    {r.obras.map((o) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(`/obras/${o.id}`)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="truncate">{o.name}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {r.expenses?.length > 0 && (
                <section>
                  <p className="mb-1.5 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Receipt className="h-3.5 w-3.5" /> Despesas
                  </p>
                  <ul className="space-y-0.5">
                    {r.expenses.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect("/despesas")}
                          className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="truncate">{e.description || e.type || "Despesa"}</span>
                          <span className="text-muted-foreground">{formatCurrency(e.value)}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {r.notifications?.length > 0 && (
                <section>
                  <p className="mb-1.5 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Bell className="h-3.5 w-3.5" /> Notificações
                  </p>
                  <ul className="space-y-0.5">
                    {r.notifications.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(n.linkHref || "/notifications")}
                          className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="truncate">{n.title}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
