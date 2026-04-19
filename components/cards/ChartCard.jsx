"use client";

import { memo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { accentCardClasses } from "@/lib/chartColors";

const titleAccentClass = {
  revenue: "text-emerald-700 dark:text-emerald-400",
  expense: "text-red-700 dark:text-red-400",
  warning: "text-amber-700 dark:text-amber-400",
  info: "text-blue-700 dark:text-blue-400",
  energy: "text-amber-700 dark:text-amber-500",
  construction: "text-violet-700 dark:text-violet-400",
  neutral: "text-slate-700 dark:text-slate-300",
  property: "text-emerald-700 dark:text-emerald-400",
};

function ChartCardComponent({
  title,
  description,
  children,
  className,
  headerClassName,
  contentClassName,
  accent,
}) {
  const headerAccent =
    accent && accentCardClasses[accent]
      ? accentCardClasses[accent]
      : "bg-muted/20";
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-xl border border-border shadow-sm",
        className
      )}
    >
      <CardHeader
        className={cn(
          "border-b border-border/50",
          headerAccent,
          headerClassName
        )}
      >
        <CardTitle
          className={cn(
            "text-base font-semibold",
            accent && titleAccentClass[accent]
          )}
        >
          {title}
        </CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className={cn("p-6", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

export const ChartCard = memo(ChartCardComponent);
