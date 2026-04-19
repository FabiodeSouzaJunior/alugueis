"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

const BAR_FILL = "url(#inadim-bar-gradient)";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/80 bg-card/95 px-5 py-4 shadow-xl shadow-black/10 backdrop-blur-sm">
      <div className="absolute right-0 top-0 h-16 w-16 translate-x-4 -translate-y-4 rounded-full bg-red-500/10" />
      <p className="relative text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="relative mt-1 text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
        {formatCurrency(value)}
      </p>
      <p className="relative mt-0.5 text-xs text-muted-foreground">em débito</p>
    </div>
  );
}

export function InadimplenciaTimeline({ data = [], formatCurrency: _formatCurrency }) {
  const sorted = [...(data || [])].sort((a, b) => {
    const [yA, mA] = (a.periodKey || "").split("-").map(Number);
    const [yB, mB] = (b.periodKey || "").split("-").map(Number);
    if (yA !== yB) return yA - yB;
    return mA - mB;
  });

  if (sorted.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/10 text-sm text-muted-foreground">
        Nenhum dado por período
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sorted}
          margin={{ top: 20, right: 16, left: 8, bottom: 12 }}
        >
          <defs>
            <linearGradient id="inadim-bar-gradient" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="hsl(0 84% 58%)" stopOpacity={0.2} />
              <stop offset="45%" stopColor="hsl(0 72% 52%)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="hsl(0 84% 62%)" stopOpacity={0.25} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
            opacity={0.4}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fontWeight: 500, fill: "hsl(var(--muted-foreground))" }}
            axisLine={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
            tickLine={false}
            dy={4}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v}`)}
            width={52}
            axisLine={false}
            tickLine={false}
            dx={-4}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.15, radius: 8 }}
          />
          <Bar
            dataKey="value"
            name="Pendente"
            radius={[6, 6, 0, 0]}
            maxBarSize={32}
            stroke="#ff1744"
            strokeWidth={1.5}
            animationDuration={600}
            animationEasing="ease-out"
            activeBar={{ fill: BAR_FILL, stroke: "#ff1744", strokeWidth: 1.5 }}
          >
            {sorted.map((entry) => (
              <Cell key={`cell-${entry.periodKey}`} fill={BAR_FILL} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
