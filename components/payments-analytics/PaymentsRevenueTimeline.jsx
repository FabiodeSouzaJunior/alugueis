"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const previsto = payload.find((p) => p.dataKey === "previsto")?.value ?? 0;
  const recebido = payload.find((p) => p.dataKey === "recebido")?.value ?? 0;
  const pct = previsto > 0 ? Math.min(100, (recebido / previsto) * 100) : 0;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/95 px-5 py-4 shadow-xl shadow-black/10 backdrop-blur-sm">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-500/10" />
      <p className="relative text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="relative mt-3 space-y-2">
        <div className="flex items-center justify-between gap-6">
          <span className="text-sm text-muted-foreground">Previsto</span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatCurrency(previsto)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-sm text-muted-foreground">Recebido</span>
          <span className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(recebido)}
          </span>
        </div>
        {previsto > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{pct.toFixed(0)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function PaymentsRevenueTimeline({ data = [], formatCurrency: _fc }) {
  const sorted = [...(data || [])].sort((a, b) => {
    const [yA, mA] = (a.periodKey || "").split("-").map(Number);
    const [yB, mB] = (b.periodKey || "").split("-").map(Number);
    if (yA !== yB) return yA - yB;
    return mA - mB;
  });

  if (sorted.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 text-sm text-muted-foreground">
        Nenhum dado por período
      </div>
    );
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} margin={{ top: 24, right: 20, left: 8, bottom: 16 }}>
          <defs>
            <linearGradient id="rev-previsto" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity={0.22} />
              <stop offset="60%" stopColor="hsl(217 91% 55%)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="hsl(217 91% 62%)" stopOpacity={0.25} />
            </linearGradient>
            <linearGradient id="rev-recebido" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="hsl(160 84% 39%)" stopOpacity={0.22} />
              <stop offset="50%" stopColor="hsl(160 84% 45%)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="hsl(160 84% 52%)" stopOpacity={0.25} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
            opacity={0.35}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fontWeight: 500, fill: "hsl(var(--muted-foreground))" }}
            axisLine={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
            tickLine={false}
            dy={6}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v}`)}
            width={54}
            axisLine={false}
            tickLine={false}
            dx={-4}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.12, radius: 8 }}
          />
          <Legend
            wrapperStyle={{ paddingTop: 8 }}
            iconType="square"
            iconSize={10}
            formatter={(value) => (
              <span className="ml-1.5 text-sm font-medium text-foreground">{value}</span>
            )}
          />
          <Bar
            dataKey="previsto"
            name="Previsto"
            fill="url(#rev-previsto)"
            stroke="#2563eb"
            strokeWidth={1.5}
            radius={[6, 6, 0, 0]}
            maxBarSize={32}
            animationDuration={600}
            animationEasing="ease-out"
            activeBar={{ fill: "url(#rev-previsto)", stroke: "#2563eb", strokeWidth: 1.5 }}
          >
            {sorted.map((_, i) => (
              <Cell key={`p-${i}`} fill="url(#rev-previsto)" stroke="#2563eb" strokeWidth={1.5} />
            ))}
          </Bar>
          <Bar
            dataKey="recebido"
            name="Recebido"
            fill="url(#rev-recebido)"
            stroke="#059669"
            strokeWidth={1.5}
            radius={[6, 6, 0, 0]}
            maxBarSize={32}
            animationDuration={600}
            animationEasing="ease-out"
            activeBar={{ fill: "url(#rev-recebido)", stroke: "#059669", strokeWidth: 1.5 }}
          >
            {sorted.map((_, i) => (
              <Cell key={`r-${i}`} fill="url(#rev-recebido)" stroke="#059669" strokeWidth={1.5} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
