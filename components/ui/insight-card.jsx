"use client";

import { cn } from "@/lib/utils";
import { accentCardClasses, accentIconClasses } from "@/lib/chartColors";

/**
 * Card analítico para a aba Insights — exibe uma análise textual elegante.
 * accent: revenue | expense | warning | info | energy | construction | neutral
 */
export function InsightCard({
  icon: Icon,
  title,
  children,
  className,
  accent,
}) {
  const cardAccent =
    accent && accentCardClasses[accent] ? accentCardClasses[accent] : "";
  const iconAccent =
    accent && accentIconClasses[accent]
      ? accentIconClasses[accent]
      : "bg-primary/10 text-primary";
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
        "flex items-start gap-3",
        cardAccent,
        className
      )}
    >
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
      <div className="min-w-0 flex-1">
        {title && (
          <p className="text-sm font-semibold text-foreground">{title}</p>
        )}
        <div className="mt-1 text-sm text-muted-foreground leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}
