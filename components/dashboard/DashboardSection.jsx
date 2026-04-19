"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

function DashboardSectionComponent({
  title,
  description,
  children,
  className,
  titleClassName,
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <header>
        <h2
          className={cn(
            "text-sm font-semibold uppercase tracking-wider text-muted-foreground",
            titleClassName
          )}
        >
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </header>
      {children}
    </section>
  );
}

export const DashboardSection = memo(DashboardSectionComponent);
