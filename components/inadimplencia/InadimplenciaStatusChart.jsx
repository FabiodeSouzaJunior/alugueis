"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS = {
  pendente: "#f59e0b",
  atrasado: "#ef4444",
};

const RADIAN = Math.PI / 180;
const pieLabelVivid = ({ cx, cy, midAngle, outerRadius, name, percent }) => {
  const fill = name === "Atrasado" ? COLORS.atrasado : COLORS.pendente;
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
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const value = item?.value ?? 0;
  const name = item?.name === "Pendente" ? "Pendente" : "Atrasado";
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
      <p className="text-sm font-medium text-foreground">{name}</p>
      <p className="text-lg font-bold tabular-nums text-foreground">
        {formatCurrency(value)}
      </p>
    </div>
  );
}

export function InadimplenciaStatusChart({ data = [], formatCurrency: _formatCurrency }) {
  const filtered = data.filter((d) => d.value > 0);
  if (filtered.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Nenhum dado para exibir
      </div>
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filtered}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={64}
            outerRadius={88}
            paddingAngle={2}
            animationDuration={400}
            animationBegin={0}
            label={pieLabelVivid}
          >
            {filtered.map((entry) => {
              const color = entry.name === "Atrasado" ? COLORS.atrasado : COLORS.pendente;
              return (
                <Cell
                  key={`cell-${entry.name}`}
                  fill={`${color}40`}
                  stroke={color}
                  strokeWidth={1.5}
                />
              );
            })}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="text-sm text-foreground">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
