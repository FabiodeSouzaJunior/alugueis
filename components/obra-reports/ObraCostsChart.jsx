"use client";

import { AdvancedBarChart } from "@/components/charts/AdvancedBarChart";
import { dataColors, categoryPalette } from "@/lib/chartColors";

const CATEGORY_COLORS = [dataColors.construction, ...categoryPalette.slice(1)];

export function ObraCostsByCategoryChart({ data }) {
  const filtered = (data || []).filter((d) => d.value > 0);
  if (filtered.length === 0) return null;
  const total = filtered.reduce((s, d) => s + (Number(d.value) || 0), 0);
  return (
    <AdvancedBarChart
      data={filtered}
      xAxisKey="name"
      series={[{ dataKey: "value", name: "Custo", color: CATEGORY_COLORS[0] }]}
      barColors={CATEGORY_COLORS}
      totalForPercent={total}
      height={280}
      maxBarSize={48}
      emptyMessage="Nenhum custo por categoria"
    />
  );
}

export function ObraCostsEvolutionChart({ data }) {
  const filtered = (data || []).filter((d) => (d.gasto ?? d.value ?? 0) > 0);
  if (filtered.length === 0) return null;
  const dataKey = "gasto" in (filtered[0] || {}) ? "gasto" : "value";
  return (
    <AdvancedBarChart
      data={filtered}
      xAxisKey="name"
      series={[{ dataKey, name: "Gasto", color: dataColors.construction }]}
      height={280}
      maxBarSize={36}
      emptyMessage="Nenhum gasto registrado"
    />
  );
}
