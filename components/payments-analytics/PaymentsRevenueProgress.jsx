"use client";

import { TrendingUp, Banknote, Clock } from "lucide-react";

export function PaymentsRevenueProgress({
  receitaPrevista = 0,
  receitaRecebida = 0,
  valorAberto = 0,
  formatCurrency,
}) {
  const pct =
    receitaPrevista > 0 ? Math.min(100, (receitaRecebida / receitaPrevista) * 100) : 0;

  const stats = [
    {
      label: "Receita prevista",
      value: formatCurrency(receitaPrevista),
      icon: TrendingUp,
      iconClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      valueClass: "text-foreground",
    },
    {
      label: "Receita recebida",
      value: formatCurrency(receitaRecebida),
      icon: Banknote,
      iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      valueClass: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Em aberto",
      value: formatCurrency(valorAberto),
      icon: Clock,
      iconClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      valueClass: "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, iconClass, valueClass }) => (
          <div
            key={label}
            className="flex min-w-0 items-center gap-4 rounded-lg border border-border bg-muted/20 p-4"
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
              <p className={`truncate text-base font-bold tabular-nums sm:text-lg ${valueClass}`}>
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-muted/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Progresso do recebimento
          </span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {pct.toFixed(1)}%
          </span>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>
    </div>
  );
}
