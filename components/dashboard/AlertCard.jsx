"use client";

import Link from "next/link";
import { AlertCircle, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const severityConfig = {
  error: {
    border: "border-red-500/30",
    bg: "bg-red-500/10 hover:bg-red-500/15",
    iconBg: "bg-red-500/20 text-red-600 dark:text-red-400",
    icon: AlertCircle,
  },
  warning: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/10 hover:bg-amber-500/15",
    iconBg: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
    icon: Clock,
  },
  info: {
    border: "border-sky-500/30",
    bg: "bg-sky-500/10 hover:bg-sky-500/15",
    iconBg: "bg-sky-500/20 text-sky-600 dark:text-sky-400",
    icon: AlertTriangle,
  },
};

export function AlertCard({ id, title, description, severity = "warning", href, icon }) {
  const config = severityConfig[severity] || severityConfig.warning;
  const Icon = icon === "clock" ? Clock : config.icon;
  const content = (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
        config.border,
        config.bg
      )}
    >
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", config.iconBg)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{title}</p>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return content;
}
