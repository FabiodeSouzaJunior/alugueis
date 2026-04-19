"use client";

import { cn } from "@/lib/utils";

const VARIANT_STYLES = {
  received: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  overdue: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
};

export function FinanceMetricCard({ title, value, icon: Icon, variant = "received" }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 shadow-sm",
        VARIANT_STYLES[variant] ?? VARIANT_STYLES.received
      )}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20 dark:bg-black/10">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium opacity-90">{title}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
        </div>
      </div>
    </div>
  );
}
