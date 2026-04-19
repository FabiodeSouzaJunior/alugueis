"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS = { Pago: "#10b981", Pendente: "#f59e0b", Atrasado: "#ef4444" };

const RADIAN = Math.PI / 180;

/** Rótulo com linha ligando a fatia ao texto "Nome XX%" (estilo inadimplentes) */
function renderLabelWithLine(labelProps) {
  const { cx, cy, midAngle, outerRadius, name, percent } = labelProps || {};
  const color = COLORS[name] ?? "#64748b";
  const x0 = cx + outerRadius * Math.cos(-midAngle * RADIAN);
  const y0 = cy + outerRadius * Math.sin(-midAngle * RADIAN);
  const lineLength = 20;
  const x1 = cx + (outerRadius + lineLength) * Math.cos(-midAngle * RADIAN);
  const y1 = cy + (outerRadius + lineLength) * Math.sin(-midAngle * RADIAN);
  const textAnchor = x1 >= cx ? "start" : "end";
  const dx = x1 >= cx ? 6 : -6;
  const pct = typeof percent === "number" && !Number.isNaN(percent) ? percent : 0;
  return (
    <g>
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={color} strokeWidth={2} />
      <text
        x={x1 + dx}
        y={y1}
        fill={color}
        textAnchor={textAnchor}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
      >
        {name} {(pct * 100).toFixed(0)}%
      </text>
    </g>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
      <p className="text-sm font-semibold text-foreground">{d.name}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{formatCurrency(d.value)}</p>
      <p className="text-xs text-muted-foreground">{d.count ?? 0} pagamento(s)</p>
    </div>
  );
}

export function PaymentStatusPieChart({ data = [] }) {
  const filtered = (data || []).filter((d) => d.value > 0);
  if (filtered.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
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
            label={renderLabelWithLine}
          >
            {filtered.map((entry) => {
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
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
