"use client";

import {
  Building2,
  Calculator,
  Receipt,
  HardHat,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { accentCardClasses, accentIconClasses } from "@/lib/chartColors";

const cardConfig = [
  {
    key: "base",
    icon: Building2,
    label: "Valor atual do condomínio base",
    description: "Vigente neste mês",
    variant: "default",
    accent: "info",
  },
  {
    key: "average",
    icon: Calculator,
    label: "Valor médio por unidade",
    description: "Base + rateios neste mês",
    variant: "primary",
    accent: null,
  },
  {
    key: "expenses",
    icon: Receipt,
    label: "Despesas do condomínio no mês",
    description: "Total de rateios ativos",
    variant: "muted",
    accent: "expense",
  },
  {
    key: "works",
    icon: HardHat,
    label: "Obras em andamento",
    description: "Rateios com parcelas ativas",
    variant: "default",
    accent: "construction",
  },
  {
    key: "collection",
    icon: TrendingUp,
    label: "Arrecadação total condomínio",
    description: "Integrado aos pagamentos",
    variant: "positive",
    accent: null,
  },
];

export function CondominiumDashboard({
  currentBaseValue = 0,
  averagePerUnit = 0,
  monthExpensesTotal = 0,
  worksInProgressCount = 0,
  totalCollection = 0,
  formatCurrency,
}) {
  const values = {
    base: currentBaseValue,
    average: averagePerUnit,
    expenses: monthExpensesTotal,
    works: worksInProgressCount,
    collection: totalCollection,
  };
  const formatters = {
    base: formatCurrency,
    average: formatCurrency,
    expenses: formatCurrency,
    works: (v) => String(v),
    collection: formatCurrency,
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cardConfig.map(({ key, icon: Icon, label, description, variant, accent }) => (
        <div
          key={key}
          className={cn(
            "rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md",
            variant === "primary" && "border-[hsl(var(--condo-accent)/0.5)] bg-[hsl(var(--condo-accent)/0.08)]",
            variant === "positive" && "border-emerald-500/30 bg-emerald-500/5",
            accent && accentCardClasses[accent]
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <p
                className={cn(
                  "mt-2 text-xl font-bold tabular-nums",
                  variant === "primary" && "text-[hsl(var(--condo-accent))]",
                  variant === "positive" && "text-emerald-600 dark:text-emerald-400"
                )}
              >
                {formatters[key](values[key])}
              </p>
              {description && (
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                variant === "primary" && "bg-[hsl(var(--condo-accent)/0.2)] text-[hsl(var(--condo-accent))]",
                variant === "positive" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                accent && accentIconClasses[accent],
                !accent && "bg-muted/60 text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
