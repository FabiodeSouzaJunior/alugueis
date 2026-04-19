"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = { Ocupadas: "#10b981", Vazias: "#64748b" };

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const pct = d.total ? Math.round((d.value / d.total) * 100) : 0;
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
      <p className="text-sm font-semibold text-foreground">{d.name}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{d.value} unidade(s)</p>
      <p className="text-xs text-muted-foreground">{pct}%</p>
    </div>
  );
}

export function OccupancyDonutChart({ occupied = 0, empty = 0 }) {
  const total = occupied + empty;
  const data = [
    { name: "Ocupadas", value: occupied, total },
    { name: "Vazias", value: empty, total },
  ].filter((d) => d.value > 0);
  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        Nenhum dado
      </div>
    );
  }
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
          >
            {data.map((entry) => {
              const color = COLORS[entry.name] || "#64748b";
              return (
                <Cell
                  key={entry.name}
                  fill={`${color}40`}
                  stroke={color}
                  strokeWidth={1.5}
                />
              );
            })}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={(value) => <span className="text-sm text-foreground">{value}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
