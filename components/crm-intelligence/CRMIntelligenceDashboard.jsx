"use client";

import {
  Users,
  Home,
  Percent,
  Clock,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { accentCardClasses, accentIconClasses } from "@/lib/chartColors";

const cards = [
  {
    key: "activeTenants",
    icon: Users,
    label: "Inquilinos ativos",
    description: "Contratos vigentes",
    variant: "default",
    accent: "info",
  },
  {
    key: "occupied",
    icon: Home,
    label: "Unidades ocupadas",
    description: "Kitnets em uso",
    variant: "default",
    accent: "info",
  },
  {
    key: "occupancyRate",
    icon: Percent,
    label: "Taxa de ocupação",
    description: "% do total",
    variant: "primary",
    accent: null,
  },
  {
    key: "avgTenureMonths",
    icon: Clock,
    label: "Tempo médio de permanência",
    description: "Meses",
    variant: "muted",
    accent: "neutral",
  },
  {
    key: "exitsThisMonth",
    icon: LogOut,
    label: "Saídas no mês",
    description: "Encerramentos",
    variant: "warning",
    accent: null,
  },
];

export function CRMIntelligenceDashboard({
  activeTenants = 0,
  occupied = 0,
  occupancyRate = 0,
  avgTenureMonths = 0,
  exitsThisMonth = 0,
}) {
  const values = {
    activeTenants,
    occupied,
    occupancyRate: `${Number(occupancyRate).toFixed(0)}%`,
    avgTenureMonths: avgTenureMonths > 0 ? `${avgTenureMonths} meses` : "-",
    exitsThisMonth,
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(({ key, icon: Icon, label, description, variant, accent }) => (
        <div
          key={key}
          className={cn(
            "rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md",
            variant === "primary" && "border-primary/30 bg-primary/5",
            variant === "positive" && "border-emerald-500/30 bg-emerald-500/5",
            variant === "warning" && "border-amber-500/30 bg-amber-500/5",
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
                  "mt-2 text-2xl font-bold tabular-nums",
                  variant === "primary" && "text-primary",
                  variant === "positive" && "text-emerald-600 dark:text-emerald-400",
                  variant === "warning" && "text-amber-600 dark:text-amber-400"
                )}
              >
                {values[key]}
              </p>
              {description && (
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                "bg-muted/60 text-muted-foreground",
                variant === "primary" && "bg-primary/10 text-primary",
                variant === "positive" && "bg-emerald-500/10 text-emerald-600",
                variant === "warning" && "bg-amber-500/10 text-amber-600",
                accent && accentIconClasses[accent]
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
