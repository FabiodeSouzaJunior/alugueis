"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { LogOut } from "lucide-react";
import { categoryPalette, accentCardClasses } from "@/lib/chartColors";

const REASON_LABELS = {
  mudanca_cidade: "Mudança de cidade",
  preco_alto: "Preço alto",
  problemas_estrutura: "Problemas na estrutura",
  mudanca_trabalho: "Mudança de trabalho",
  outro: "Outro",
};

const COLORS = categoryPalette;

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

export function ExitReasonsChart({ exitReasonsCount = {} }) {
  const data = Object.entries(exitReasonsCount)
    .filter(([, count]) => count > 0)
    .map(([code, count], i) => ({
      name: REASON_LABELS[code] || code,
      value: count,
      fill: COLORS[i % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
      <CardHeader className={`border-b border-border/50 ${accentCardClasses.neutral}`}>
        <div className="flex items-center gap-2">
          <LogOut className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">Motivos de saída</CardTitle>
        </div>
        <CardDescription>Principais razões de encerramento de contrato</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma saída registrada com motivo ainda.
          </p>
        ) : (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={pieLabelVivid}
                >
                  {data.map((entry, i) => {
                  const color = entry.fill || COLORS[i % COLORS.length];
                  return (
                    <Cell
                      key={i}
                      fill={`${color}40`}
                      stroke={color}
                      strokeWidth={1.5}
                    />
                  );
                })}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
