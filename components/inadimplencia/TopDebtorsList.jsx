"use client";

import { User, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

export function TopDebtorsList({ items = [], formatCurrency, metric = "amount" }) {
  if (!items?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center">
        <p className="text-sm text-muted-foreground">Nenhum débito para ranquear.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={item.tenantId}
          className={cn(
            "flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/30"
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium text-foreground">{item.tenantName}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <Hash className="h-3.5 w-3.5 shrink-0" />
                <span>Kitnet {item.kitnetNumber}</span>
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            {metric === "installments" ? (
              <>
                <span className="block font-bold tabular-nums text-red-600 dark:text-red-400">
                  {item.parcelasEmAberto ?? 0}{" "}
                  {item.parcelasEmAberto === 1 ? "parcela" : "parcelas"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(item.totalPendente)}
                </span>
              </>
            ) : (
              <span className="font-bold tabular-nums text-red-600 dark:text-red-400">
                {formatCurrency(item.totalPendente)}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
