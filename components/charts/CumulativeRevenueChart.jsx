"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value ?? 0;
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
        {formatCurrency(v)}
      </p>
      <p className="text-[10px] text-muted-foreground">receita do mês</p>
    </div>
  );
}

export function CumulativeRevenueChart({ data = [] }) {
  const filtered = (data || []).filter((d) => d.name != null);
  if (filtered.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        Nenhum dado para exibir
      </div>
    );
  }
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={filtered} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="cumulativeRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} width={48} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="acumulado"
            name="Receita acumulada"
            stroke="#059669"
            strokeWidth={2}
            fill="url(#cumulativeRevenue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
