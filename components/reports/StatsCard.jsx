"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { accentCardClasses, accentIconClasses } from "@/lib/chartColors";

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  variant,
  accent,
  trend,
  trendLabel,
}) {
  const hasVariant = variant === "positive" || variant === "negative";
  const cardAccent =
    !hasVariant && accent && accentCardClasses[accent]
      ? accentCardClasses[accent]
      : "";
  const iconAccent =
    !hasVariant && accent && accentIconClasses[accent]
      ? accentIconClasses[accent]
      : "bg-muted/50 text-muted-foreground";
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm",
        variant === "positive" && "border-emerald-500/30 bg-emerald-500/5",
        variant === "negative" && "border-red-500/30 bg-red-500/5",
        cardAccent
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p
            className={cn(
              "mt-1 text-lg font-semibold tabular-nums",
              variant === "positive" && "text-emerald-600 dark:text-emerald-400",
              variant === "negative" && "text-red-600 dark:text-red-400"
            )}
          >
            {value}
          </p>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
          {trend != null && trendLabel && (
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              {trend >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              )}
              <span
                className={cn(
                  trend >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {trend >= 0 ? "+" : ""}
                {trend}%
              </span>
              <span className="text-muted-foreground">{trendLabel}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              iconAccent
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
