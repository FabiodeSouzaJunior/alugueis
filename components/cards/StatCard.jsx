"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { accentCardClasses, accentIconClasses } from "@/lib/chartColors";

const variantStyles = {
  default: "",
  positive: "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10",
  negative: "border-red-500/30 bg-red-500/5 dark:bg-red-500/10",
  warning: "border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10",
  muted: "border-border bg-muted/30",
};

const valueStyles = {
  default: "text-foreground",
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  muted: "text-muted-foreground",
};

function StatCardComponent({
  title,
  value,
  description,
  icon: Icon,
  variant = "default",
  accent,
  trend,
  trendLabel,
  className,
}) {
  const hasVariantStyle = variant && variantStyles[variant];
  const cardAccent =
    !hasVariantStyle &&
    accent &&
    accentCardClasses[accent]
      ? accentCardClasses[accent]
      : "";
  const iconAccent =
    !hasVariantStyle &&
    accent &&
    accentIconClasses[accent]
      ? accentIconClasses[accent]
      : "bg-muted/50 text-muted-foreground";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md",
        variantStyles[variant] || variantStyles.default,
        cardAccent,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p
            className={cn(
              "mt-1 truncate text-xl font-bold tabular-nums sm:text-2xl",
              valueStyles[variant] || valueStyles.default
            )}
          >
            {value}
          </p>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
          {trend != null && (
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  "font-medium",
                  trend > 0 ? "text-emerald-600 dark:text-emerald-400" : trend < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                )}
              >
                {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {Math.abs(trend)}%
              </span>
              {trendLabel && (
                <span className="text-muted-foreground">{trendLabel}</span>
              )}
            </div>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              iconAccent
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export const StatCard = memo(StatCardComponent);
