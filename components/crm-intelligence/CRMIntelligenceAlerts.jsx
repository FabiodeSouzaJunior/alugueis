"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, AlertCircle, TrendingDown, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { accentCardClasses } from "@/lib/chartColors";

const ALERT_CONFIG = {
  low_satisfaction: {
    icon: AlertCircle,
    label: "Satisfação baixa",
    variant: "amber",
  },
  high_exits: {
    icon: TrendingDown,
    label: "Muitas saídas",
    variant: "destructive",
  },
  high_vacancy: {
    icon: AlertTriangle,
    label: "Alta vacância",
    variant: "amber",
  },
  overdue: {
    icon: CreditCard,
    label: "Pagamentos em atraso",
    variant: "destructive",
  },
};

export function CRMIntelligenceAlerts({ alerts = [] }) {
  return (
    <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
      <CardHeader className={cn("border-b border-border/50", accentCardClasses.warning)}>
        <CardTitle className="text-base font-semibold">Alertas inteligentes</CardTitle>
        <CardDescription>Ações recomendadas para gestão</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {alerts.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum alerta no momento.
          </p>
        ) : (
          <ul className="space-y-3">
            {alerts.map((a, i) => {
              const config = ALERT_CONFIG[a.type] || { icon: AlertTriangle, label: a.type, variant: "default" };
              const Icon = config.icon;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-3",
                    config.variant === "destructive" && "border-destructive/30 bg-destructive/5",
                    config.variant === "amber" && "border-amber-500/30 bg-amber-500/5"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      config.variant === "destructive" && "text-destructive",
                      config.variant === "amber" && "text-amber-600"
                    )}
                  />
                  <span className="text-sm font-medium">{a.message}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
