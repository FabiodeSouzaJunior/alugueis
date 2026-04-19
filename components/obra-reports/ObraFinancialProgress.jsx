"use client";

import { cn } from "@/lib/utils";

export function ObraFinancialProgress({
  budgetLabel,
  budgetValue,
  spentLabel,
  spentValue,
  remainingLabel,
  remainingValue,
  budgetNumeric = 0,
  spentNumeric = 0,
}) {
  const budget = Number(budgetNumeric) || 0;
  const spent = Number(spentNumeric) || 0;
  const progressPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{budgetLabel}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{budgetValue}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{spentLabel}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-amber-600 dark:text-amber-400">
            {spentValue}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{remainingLabel}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {remainingValue}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              progressPct > 100 ? "bg-red-500" : "bg-primary"
            )}
            style={{ width: `${Math.min(100, progressPct)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {progressPct.toFixed(0)}% do orçamento utilizado
        </p>
      </div>
    </div>
  );
}
