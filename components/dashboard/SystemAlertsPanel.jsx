"use client";

import Link from "next/link";
import { AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function SystemAlertsPanel({ alerts = [] }) {
  if (!alerts?.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum alerta no momento.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {alerts.map((alert) => {
        const isError = alert.severity === "error";
        const content = (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
              isError
                ? "border-red-500/30 bg-red-500/10 hover:bg-red-500/15"
                : "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15"
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                isError ? "bg-red-500/20 text-red-600 dark:text-red-400" : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
              )}
            >
              {alert.icon === "clock" ? (
                <Clock className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{alert.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{alert.description}</p>
            </div>
          </div>
        );
        if (alert.href) {
          return (
            <li key={alert.id}>
              <Link href={alert.href}>{content}</Link>
            </li>
          );
        }
        return <li key={alert.id}>{content}</li>;
      })}
    </ul>
  );
}
