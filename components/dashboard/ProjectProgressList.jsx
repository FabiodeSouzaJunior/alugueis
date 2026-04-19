"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Building2, ChevronRight } from "lucide-react";

export function ProjectProgressList({ projects = [], formatCurrency }) {
  if (!projects?.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhuma obra cadastrada.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {projects.map((p) => (
        <li key={p.id}>
          <Link
            href={`/obras/${p.id}`}
            className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(p.costTotal ?? 0)} · {p.progressPct ?? 0}% concluído
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  (p.status || "").toLowerCase() === "concluída"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                )}
              >
                {p.status === "concluída" ? "Concluída" : "Em andamento"}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
