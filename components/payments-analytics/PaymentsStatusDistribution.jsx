"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS = {
  pago: "#10b981",
  pendente: "#f59e0b",
  atrasado: "#ef4444",
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const data = item?.payload;
  if (!data) return null;
  return (
    <div className="rounded-xl border border-border/80 bg-card/95 px-4 py-3 shadow-lg backdrop-blur-sm">
      <p className="text-sm font-semibold text-foreground">{data.name}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
        {formatCurrency(data.value)}
      </p>
      <p className="text-xs text-muted-foreground">{data.count} pagamento(s)</p>
    </div>
  );
}

export function PaymentsStatusDistribution({ data = [], formatCurrency: _fc }) {
  const filtered = (data || []).filter((d) => d.value > 0);
  if (filtered.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 text-sm text-muted-foreground">
        Nenhum dado para exibir
      </div>
    );
  }

  const colorMap = (name) =>
    name === "Pago" ? COLORS.pago : name === "Pendente" ? COLORS.pendente : COLORS.atrasado;

  const RADIAN = Math.PI / 180;
  const pieLabelVivid = ({ cx, cy, midAngle, outerRadius, name, percent }) => {
    const fill = colorMap(name);
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

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filtered}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={95}
            paddingAngle={2}
            animationDuration={500}
            animationBegin={0}
            label={pieLabelVivid}
          >
            {filtered.map((entry) => {
              const color = colorMap(entry.name);
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
          <Legend
            formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
