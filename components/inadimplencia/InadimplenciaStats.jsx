"use client";

import { Users, DollarSign, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const cardConfig = {
  inquilinos: {
    icon: Users,
    label: "Total de inquilinos inadimplentes",
    description: "Pessoas com saldo em aberto",
    className: "border-slate-500/30 bg-slate-500/5",
    valueClassName: "text-foreground",
  },
  valorDebito: {
    icon: DollarSign,
    label: "Valor total em débito",
    description: "Soma de todos os valores em aberto",
    className: "border-red-500/30 bg-red-500/5",
    valueClassName: "text-red-600 dark:text-red-400",
  },
  atrasados: {
    icon: AlertTriangle,
    label: "Saldo atrasado",
    description: "Parcelas vencidas em aberto",
    className: "border-red-500/30 bg-red-500/5",
    valueClassName: "text-red-600 dark:text-red-400",
  },
  pendentes: {
    icon: Clock,
    label: "Saldo pendente",
    description: "Parcelas em aberto no prazo",
    className: "border-amber-500/30 bg-amber-500/5",
    valueClassName: "text-amber-600 dark:text-amber-400",
  },
};

export function InadimplenciaStats({
  totalInadimplentes = 0,
  valorTotalDebito = 0,
  totalAtrasado = 0,
  totalPendente = 0,
  countAtrasados = 0,
  countPendentes = 0,
  formatCurrency,
}) {
  const stats = [
    {
      key: "inquilinos",
      value: totalInadimplentes,
      formatter: (v) => String(v),
      subtitle: null,
    },
    {
      key: "valorDebito",
      value: valorTotalDebito,
      formatter: formatCurrency,
      subtitle: null,
    },
    {
      key: "atrasados",
      value: totalAtrasado,
      formatter: formatCurrency,
      subtitle: countAtrasados > 0 ? `${countAtrasados} parcela(s)` : null,
    },
    {
      key: "pendentes",
      value: totalPendente,
      formatter: formatCurrency,
      subtitle: countPendentes > 0 ? `${countPendentes} parcela(s)` : null,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(({ key, value, formatter, subtitle }) => {
        const config = cardConfig[key];
        const Icon = config.icon;
        return (
          <div
            key={key}
            className={cn(
              "flex min-h-[120px] flex-col rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md",
              config.className
            )}
          >
            <div className="flex flex-1 flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium leading-tight text-muted-foreground">
                  {config.label}
                </p>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 text-muted-foreground">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className={cn("text-2xl font-bold tabular-nums", config.valueClassName)}>
                {formatter(value)}
              </p>
              {config.description && (
                <p className="text-xs leading-snug text-muted-foreground">
                  {config.description}
                </p>
              )}
              {subtitle && (
                <p className="text-xs font-medium text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
