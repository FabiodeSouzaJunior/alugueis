"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="text-sm" style={{ color: entry.color }}>{entry.name}</span>
            <span className="text-sm font-semibold tabular-nums">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const COLORS = { receita: "#10b981", despesas: "#ef4444", lucro: "#3b82f6" };

export function RevenueExpenseLineChart({ data = [] }) {
  const filtered = (data || []).filter((d) => d.name);
  if (filtered.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        Nenhum dado para exibir
      </div>
    );
  }
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={filtered} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} width={48} />
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={(value) => <span className="text-sm text-foreground">{value}</span>} />
          <Line type="monotone" dataKey="receita" name="Receita" stroke={COLORS.receita} strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="despesas" name="Despesas" stroke={COLORS.despesas} strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="lucro" name="Lucro" stroke={COLORS.lucro} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
