"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { getNotificationConfig } from "@/lib/notificationTypes";

const colorClasses = {
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  yellow: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  red: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  purple: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
};

export function NotificationItem({
  notification,
  onMarkRead,
  compact = false,
}) {
  const { type, title, message, linkHref, createdAt, readAt } = notification;
  const config = getNotificationConfig(type);
  const Icon = config.icon;
  const colorClass = colorClasses[config.color] || colorClasses.blue;
  const isUnread = !readAt;

  const content = (
    <>
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
          colorClass
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium text-foreground", isUnread && "font-semibold")}>
          {title}
        </p>
        {!compact && message && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{message}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {createdAt ? formatRelativeTime(createdAt) : ""}
        </p>
      </div>
    </>
  );

  const className = cn(
    "flex gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
    isUnread && "bg-primary/5",
    "hover:bg-muted/50",
    compact ? "py-2" : "py-2.5"
  );

  if (linkHref) {
    return (
      <Link
        href={linkHref}
        className={className}
        onClick={() => onMarkRead?.(notification.id)}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={cn(className, "cursor-default")}
      onClick={() => onMarkRead?.(notification.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onMarkRead?.(notification.id);
        }
      }}
    >
      {content}
    </div>
  );
}

function formatRelativeTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffM = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffM < 1) return "Agora";
  if (diffM < 60) return `${diffM} min atrás`;
  if (diffH < 24) return `${diffH}h atrás`;
  if (diffD < 7) return `${diffD} dia(s) atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
