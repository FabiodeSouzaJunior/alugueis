"use client";

import Link from "next/link";
import { User, Hash, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { accentCardClasses, accentIconClasses } from "@/lib/chartColors";

export function DashboardTopDebtors({ items = [], formatCurrency }) {
  if (!items?.length) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center",
          accentCardClasses.expense
        )}
      >
        <p className="text-sm text-muted-foreground">Nenhum débito para ranquear.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={item.tenantId ?? index}
          className={cn(
            "flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 transition-colors",
            accentCardClasses.warning
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                accentIconClasses.expense
              )}
            >
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
                {item.diasAtraso != null && (
                  <span className="text-red-600 dark:text-red-400">
                    · {item.diasAtraso} dia(s) em atraso
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-right font-bold tabular-nums text-red-600 dark:text-red-400">
              {formatCurrency(item.totalPendente)}
            </span>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/inadimplentes" className="gap-1">
                <ArrowRight className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only">Pagamentos</span>
              </Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
