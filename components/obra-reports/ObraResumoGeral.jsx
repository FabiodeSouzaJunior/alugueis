"use client";

import { Wallet, Package, Users, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function ObraResumoGeral({
  costTotal = 0,
  budget = 0,
  remaining = 0,
  materialTotal = 0,
  maoDeObraTotal = 0,
  outrosTotal = 0,
  formatCurrency,
  costsCount = 0,
}) {
  const budgetNum = Number(budget) || 0;
  const pctUsed = budgetNum > 0 ? (costTotal / budgetNum) * 100 : 0;

  return (
    <div className="flex min-h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-muted/30 px-6 py-4">
        <h3 className="font-semibold text-foreground">Resumo geral</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Composição dos custos e situação do orçamento
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-3">
            <Package className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Material</p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(materialTotal)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Mão de obra</p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(maoDeObraTotal)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-3 sm:col-span-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Outros</p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(outrosTotal)}</p>
            </div>
          </div>
        </div>
        <div className="mt-auto space-y-2 rounded-lg border-2 border-border bg-muted/20 px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-muted-foreground">Total gasto</span>
            <span className="font-semibold tabular-nums">{formatCurrency(costTotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-muted-foreground">Restante</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}
            >
              {formatCurrency(remaining)}
            </span>
          </div>
          {budgetNum > 0 && (
            <p className="text-xs text-muted-foreground">
              {pctUsed.toFixed(0)}% do orçamento utilizado · {costsCount} lançamento(s)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
