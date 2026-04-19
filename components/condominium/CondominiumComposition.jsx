"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const COLORS = [
  "hsl(var(--condo-accent))",
  "hsl(217 25% 55%)",
  "hsl(217 20% 65%)",
  "hsl(217 15% 75%)",
  "#94a3b8",
  "#64748b",
  "#475569",
];

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

export function CondominiumComposition({
  composition = [],
  totalPerUnit = 0,
  periodLabel = "",
  formatCurrency,
}) {
  const data = composition.map((item, i) => ({
    name: item.label,
    value: item.value,
    fill: COLORS[i % COLORS.length],
  })).filter((d) => d.value > 0);

  return (
    <Card className="overflow-hidden rounded-xl border border-[hsl(var(--condo-accent)/0.25)] shadow-sm">
      <CardHeader className="border-b border-[hsl(var(--condo-accent)/0.2)] bg-[hsl(var(--condo-accent)/0.06)]">
        <CardTitle className="text-base font-semibold text-[hsl(var(--condo-accent))]">Composição do condomínio</CardTitle>
        <CardDescription>
          Como o valor final é formado por unidade
          {periodLabel ? ` (${periodLabel})` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {composition.map((row, i) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.value)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Total condomínio</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(totalPerUnit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="flex min-h-[240px] items-center justify-center">
            {data.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum valor neste período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={pieLabelVivid}
                  >
                    {data.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.fill}
                        fillOpacity={0.4}
                        stroke={entry.fill}
                        strokeWidth={1.5}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
