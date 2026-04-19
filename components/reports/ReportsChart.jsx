"use client";

import {
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { AdvancedBarChart } from "@/components/charts/AdvancedBarChart";

const CHART_COLORS = {
  revenue: "#10b981",
  expenses: "#ef4444",
  received: "#10b981",
  pending: "#f59e0b",
  overdue: "#ef4444",
};

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground">{item.name}</span>
        <span className="text-sm font-semibold tabular-nums">{formatCurrency(item.value)}</span>
      </div>
    </div>
  );
}

export function RevenueVsExpensesChart({ data }) {
  if (!data?.length) return null;
  return (
    <AdvancedBarChart
      data={data}
      xAxisKey="name"
      series={[
        { dataKey: "Receita", name: "Receita", color: CHART_COLORS.revenue },
        { dataKey: "Despesas", name: "Despesas", color: CHART_COLORS.expenses },
      ]}
      height={280}
      maxBarSize={48}
      barGap={12}
      emptyMessage="Sem dados para exibir"
    />
  );
}

const RADIAN = Math.PI / 180;
function pieLabelVivid({ cx, cy, midAngle, outerRadius, name, percent, fill }) {
  const x = cx + (outerRadius + 16) * Math.cos(-midAngle * RADIAN);
  const y = cy + (outerRadius + 16) * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill={fill}
      textAnchor={x >= cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {name} {(percent * 100).toFixed(0)}%
    </text>
  );
}

export function PaymentDistributionChart({ data }) {
  if (!data?.length) return null;
  const getColorByName = (name) => {
    const key = String(name || "").toLowerCase();
    if (key === "recebido") return CHART_COLORS.received;
    if (key === "pendente") return CHART_COLORS.pending;
    if (key === "atrasado") return CHART_COLORS.overdue;
    return CHART_COLORS.pending;
  };

  const dataWithFill = data.map((d) => ({ ...d, fill: getColorByName(d.name) }));
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={dataWithFill}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            label={pieLabelVivid}
          >
            {dataWithFill.map((item, index) => {
              const color = item.fill || CHART_COLORS.pending;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={`${color}40`}
                  stroke={color}
                  strokeWidth={1.5}
                />
              );
            })}
          </Pie>
          <Tooltip content={<PieTooltip />} />
          <Legend formatter={(value) => <span className="text-sm text-foreground">{value}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
