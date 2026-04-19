"use client";

import { memo } from "react";
import Link from "next/link";
import {
  Banknote,
  Receipt,
  HardHat,
  UserPlus,
  Star,
  Wallet,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_CONFIG = {
  payment: {
    icon: Banknote,
    label: "Pagamento",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    href: "/pagamentos",
  },
  expense: {
    icon: Receipt,
    label: "Despesa",
    className: "bg-red-500/15 text-red-600 dark:text-red-400",
    href: "/despesas",
  },
  cost: {
    icon: Wallet,
    label: "Custo obra",
    className: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    href: "/obras",
  },
  obra: {
    icon: HardHat,
    label: "Obra",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    href: "/obras",
  },
  tenant: {
    icon: UserPlus,
    label: "Novo inquilino",
    className: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    href: "/inquilinos",
  },
  evaluation: {
    icon: Star,
    label: "Avaliação",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    href: "/crm",
  },
};

function ActivityTimelineComponent({ items = [], formatCurrency, formatDate }) {
  if (!items?.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma atividade recente.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item, index) => {
        const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.payment;
        const Icon = config.icon;
        const href = item.href ?? config.href;
        const content = (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40">
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", config.className)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {item.value != null ? formatCurrency(item.value) : item.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {item.detail ?? config.label}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {item.date ? formatDate(item.date) : "–"}
            </span>
            {href && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          </div>
        );
        return (
          <li key={item.id ?? index}>
            {href ? <Link href={href}>{content}</Link> : content}
          </li>
        );
      })}
    </ul>
  );
}

export const ActivityTimeline = memo(ActivityTimelineComponent);
