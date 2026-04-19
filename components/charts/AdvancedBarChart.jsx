"use client";

import { memo, useMemo, useId } from "react";
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

function AdvancedBarTooltip({
  active,
  payload,
  label,
  formatValue = formatCurrency,
  totalForPercent,
}) {
  if (!active || !payload?.length) return null;
  const showPercent = totalForPercent != null && totalForPercent > 0 && payload.length === 1;
  const value = payload[0].value;
  const pct = showPercent ? ((Number(value) || 0) / totalForPercent) * 100 : null;

  return (
    <div
      className="rounded-xl px-4 py-3 shadow-xl"
      style={{
        backgroundColor: "hsl(0 0% 9% / 0.96)",
        boxShadow: "0 20px 40px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-6">
            <span className="text-sm text-zinc-300">{entry.name}</span>
            <span className="text-sm font-semibold tabular-nums text-zinc-50">
              {formatValue(entry.value)}
            </span>
          </div>
        ))}
      </div>
      {pct != null && (
        <p className="mt-2 border-t border-zinc-600/60 pt-2 text-xs text-zinc-500">
          {pct.toFixed(1)}% do total
        </p>
      )}
    </div>
  );
}

function AdvancedBarChartComponent({
  data = [],
  xAxisKey = "name",
  series = [{ dataKey: "value", name: "Valor", color: "hsl(var(--primary))" }],
  barColors,
  formatValue = formatCurrency,
  totalForPercent,
  height = 280,
  yAxisFormatter = (v) => `R$ ${(v / 1000).toFixed(0)}k`,
  maxBarSize = 44,
  barGap = 8,
  allowNegative = false,
  emptyMessage = "Nenhum dado para exibir",
}) {
  const filtered = useMemo(
    () => data.filter((d) => {
      const hasDefined = series.some((s) => {
        const v = Number(d[s.dataKey]);
        return !isNaN(v);
      });
      if (!hasDefined) return false;
      if (allowNegative) return true;
      if (series.length > 1) return true;
      return series.some((s) => (Number(d[s.dataKey]) || 0) > 0);
    }),
    [data, series, allowNegative]
  );

  const yDomain = useMemo(() => {
    if (!allowNegative || filtered.length === 0) return undefined;
    let min = 0;
    let max = 0;
    filtered.forEach((d) => {
      series.forEach((s) => {
        const v = Number(d[s.dataKey]) || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      });
    });
    const padding = Math.max((max - min) * 0.05, 1);
    return [min - padding, max + padding];
  }, [filtered, series, allowNegative]);

  const computedTotal = useMemo(() => {
    if (totalForPercent != null) return totalForPercent;
    if (series.length === 1) {
      return filtered.reduce((s, d) => s + (Number(d[series[0].dataKey]) || 0), 0);
    }
    return null;
  }, [filtered, series, totalForPercent]);

  if (filtered.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height: `${height}px` }}
      >
        {emptyMessage}
      </div>
    );
  }

  const useBarColors = series.length === 1 && Array.isArray(barColors) && barColors.length > 0;
  const uid = useId().replace(/:/g, "");

  return (
    <div className="w-full" style={{ height: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={filtered}
          margin={{ top: 16, right: 16, left: 0, bottom: 4 }}
          barGap={series.length > 1 ? barGap : 4}
          barCategoryGap="20%"
        >
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.dataKey}
                id={`bar-gradient-${uid}-${s.dataKey}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.2} />
              </linearGradient>
            ))}
            {useBarColors && barColors.map((c, i) => (
              <linearGradient
                key={i}
                id={`bar-gradient-cell-${uid}-${i}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={c} stopOpacity={0.28} />
                <stop offset="100%" stopColor={c} stopOpacity={0.2} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
            strokeOpacity={0.35}
          />
          <XAxis
            dataKey={xAxisKey}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))", strokeOpacity: 0.5 }}
          />
          <YAxis
            domain={yDomain ?? [0, (max) => Math.max(max * 1.05, 1)]}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={yAxisFormatter}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            content={
              <AdvancedBarTooltip
                formatValue={formatValue}
                totalForPercent={computedTotal}
              />
            }
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.15 }}
            offset={0}
          />
          {series.map((s) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.name}
              fill={useBarColors ? undefined : `url(#bar-gradient-${uid}-${s.dataKey})`}
              stroke={s.color}
              strokeWidth={1.5}
              radius={[6, 6, 0, 0]}
              maxBarSize={maxBarSize}
              isAnimationActive
              animationDuration={600}
              animationEasing="ease-out"
              activeBar={useBarColors ? false : {
                fill: s.color,
                fillOpacity: 0.26,
                stroke: s.color,
                strokeWidth: 1.5,
              }}
            >
              {useBarColors
                ? filtered.map((_, i) => {
                    const color = barColors[i % barColors.length];
                    return (
                      <Cell
                        key={i}
                        fill={`url(#bar-gradient-cell-${uid}-${i % barColors.length})`}
                        stroke={color}
                        strokeWidth={1.5}
                      />
                    );
                  })
                : null}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const AdvancedBarChart = memo(AdvancedBarChartComponent);
