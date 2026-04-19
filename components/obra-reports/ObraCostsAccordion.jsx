"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ObraCostsAccordion({
  title,
  totalLabel,
  totalValue,
  categories = [],
  formatCurrency,
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/30"
      >
        <span className="font-semibold text-foreground">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {totalLabel}: <span className="font-semibold text-foreground">{totalValue}</span>
          </span>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3">
          <ul className="space-y-2">
            {categories.map((cat) => (
              <li
                key={cat.name}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">{cat.name}</span>
                <span className="font-medium tabular-nums">{formatCurrency(cat.value ?? 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
