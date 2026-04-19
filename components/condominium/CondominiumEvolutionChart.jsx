"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function CondominiumEvolutionChart({
  billingHistory = [],
  formatCurrency,
}) {
  const data = [...billingHistory]
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
    .map((row) => ({
      period: row.periodLabel,
      total: row.totalValue,
      base: row.baseValue,
      extras: row.extrasTotal,
    }));

  return (
    <Card className="overflow-hidden rounded-xl border border-[hsl(var(--condo-accent)/0.25)] shadow-sm">
      <CardHeader className="border-b border-[hsl(var(--condo-accent)/0.2)] bg-[hsl(var(--condo-accent)/0.06)]">
        <CardTitle className="text-base font-semibold text-[hsl(var(--condo-accent))]">Evolução do valor do condomínio</CardTitle>
        <CardDescription>
          Total cobrado por unidade ao longo do tempo.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Sem dados para exibir.
          </p>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                <Tooltip formatter={(value) => [formatCurrency(value), "Total"]} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="hsl(var(--condo-accent))"
                  fill="hsl(var(--condo-accent))"
                  fillOpacity={0.22}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
