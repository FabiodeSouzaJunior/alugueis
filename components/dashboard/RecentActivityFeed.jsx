"use client";

import { Banknote, Receipt, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_CONFIG = {
  payment: { icon: Banknote, label: "Pagamento", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  expense: { icon: Receipt, label: "Despesa", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
  cost: { icon: Wallet, label: "Custo obra", className: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
};

export function RecentActivityFeed({ items = [], formatCurrency, formatDate }) {
  if (!items?.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhuma atividade recente.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.payment;
        const Icon = config.icon;
        return (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5"
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                config.className
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {formatCurrency(item.value ?? 0)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {item.detail ?? config.label}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {item.date ? formatDate(item.date) : "–"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
