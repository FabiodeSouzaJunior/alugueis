"use client";

import { accentCardClasses, accentIconClasses } from "@/lib/chartColors";
import { cn } from "@/lib/utils";

export function PaymentsTopDebts({ items = [], formatCurrency }) {
  if (!items?.length) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center",
          accentCardClasses.warning
        )}
      >
        <p className="text-sm text-muted-foreground">Nenhuma dívida em aberto.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-foreground">
              #
            </th>
            <th className="min-w-[120px] whitespace-nowrap px-4 py-3 text-left font-semibold text-foreground">
              Inquilino
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-muted-foreground">
              Kitnet
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-semibold text-foreground tabular-nums">
              Valor em débito
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-center font-semibold text-muted-foreground">
              Parcelas
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, index) => (
            <tr
              key={row.tenantId ?? index}
              className="border-b border-border/50 transition-colors hover:bg-muted/20 last:border-0"
            >
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    accentIconClasses.expense
                  )}
                >
                  {index + 1}
                </span>
              </td>
              <td className="min-w-0 px-4 py-3">
                <span className="block truncate font-medium text-foreground" title={row.tenantName}>
                  {row.tenantName}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {row.kitnetNumber ?? "–"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-red-600 dark:text-red-400">
                {formatCurrency(row.totalPendente)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-center text-muted-foreground">
                {row.parcelasEmAberto ?? 0}{" "}
                {row.parcelasEmAberto === 1 ? "parcela" : "parcelas"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
