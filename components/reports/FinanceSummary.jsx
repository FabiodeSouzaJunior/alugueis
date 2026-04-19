"use client";

import { Minus } from "lucide-react";

export function FinanceSummary({
  receivedLabel,
  receivedValue,
  expensesLabel,
  expensesValue,
  resultLabel,
  resultValue,
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-muted-foreground">{receivedLabel}</span>
          <span className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {receivedValue}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Minus className="h-4 w-4" />
          <span className="text-sm">({expensesLabel}: {expensesValue})</span>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <span className="font-medium text-foreground">{resultLabel}</span>
          <span className="text-lg font-bold tabular-nums">{resultValue}</span>
        </div>
      </div>
    </div>
  );
}
