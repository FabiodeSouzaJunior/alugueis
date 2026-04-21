"use client";

import {
  Receipt,
  Banknote,
  Clock,
  AlertTriangle,
  TrendingUp,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";

const configs = {
  total: {
    icon: Receipt,
    label: "Total de pagamentos",
    description: "Registros no sistema",
    className: "border-slate-500/30 bg-slate-500/5",
    valueClassName: "text-foreground",
  },
  recebido: {
    icon: Banknote,
    label: "Total recebido",
    description: "Valor já pago",
    className: "border-emerald-500/30 bg-emerald-500/5",
    valueClassName: "text-emerald-600 dark:text-emerald-400",
  },
  pendente: {
    icon: Clock,
    label: "Total pendente",
    description: "Saldo em aberto no prazo",
    className: "border-amber-500/30 bg-amber-500/5",
    valueClassName: "text-amber-600 dark:text-amber-400",
  },
  atrasado: {
    icon: AlertTriangle,
    label: "Total atrasado",
    description: "Vencido",
    className: "border-red-500/30 bg-red-500/5",
    valueClassName: "text-red-600 dark:text-red-400",
  },
  previsto: {
    icon: TrendingUp,
    label: "Receita prevista",
    description: "Soma a receber se todos pagarem",
    className: "border-blue-500/30 bg-blue-500/5",
    valueClassName: "text-blue-600 dark:text-blue-400",
  },
  taxa: {
    icon: Percent,
    label: "Taxa de adimplência",
    description: "% quitado",
    className: "border-emerald-500/30 bg-emerald-500/5",
    valueClassName: "text-emerald-600 dark:text-emerald-400",
  },
};

export function PaymentsAnalyticsStats({
  totalPagamentos = 0,
  totalRecebido = 0,
  totalPendente = 0,
  totalAtrasado = 0,
  receitaPrevista = 0,
  taxaAdimplencia = 0,
  formatCurrency,
}) {
  const stats = [
    { key: "total", value: totalPagamentos, formatter: (v) => String(v) },
    { key: "recebido", value: totalRecebido, formatter: formatCurrency },
    { key: "pendente", value: totalPendente, formatter: formatCurrency },
    { key: "atrasado", value: totalAtrasado, formatter: formatCurrency },
    { key: "previsto", value: receitaPrevista, formatter: formatCurrency },
    { key: "taxa", value: taxaAdimplencia, formatter: (v) => `${Number(v).toFixed(1)}%` },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {stats.map(({ key, value, formatter }) => {
        const config = configs[key];
        const Icon = config.icon;
        return (
          <div
            key={key}
            className={cn(
              "rounded-xl border p-4 shadow-sm transition-all hover:shadow-md",
              config.className
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">{config.label}</p>
                <p className={cn("mt-1 text-xl font-bold tabular-nums", config.valueClassName)}>
                  {formatter(value)}
                </p>
                {config.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{config.description}</p>
                )}
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/5 dark:bg-white/5 text-muted-foreground">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
