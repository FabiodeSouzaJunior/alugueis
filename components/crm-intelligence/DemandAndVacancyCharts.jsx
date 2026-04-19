"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdvancedBarChart } from "@/components/charts/AdvancedBarChart";
import { dataColors, accentCardClasses } from "@/lib/chartColors";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function formatMonth(key) {
  if (!key) return "";
  const [y, m] = String(key).split("-").map(Number);
  return `${MONTH_NAMES[(m || 1) - 1]}/${y || ""}`;
}

function formatCount(value) {
  if (value == null || isNaN(value)) return "0";
  return String(Number(value));
}

export function DemandAndVacancyCharts({
  entriesByMonth = [],
  exitsByMonth = [],
  totalKitnets = 12,
}) {
  const combined = entriesByMonth.map((e, i) => {
    const ex = exitsByMonth[i] || {};
    const month = e.month || ex.month;
    const entries = e.count ?? 0;
    const exits = ex.count ?? 0;
    return {
      month,
      label: formatMonth(month),
      entradas: entries,
      saídas: exits,
      saldo: entries - exits,
    };
  }).filter((d) => d.month);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
        <CardHeader className={cn("border-b border-border/50", accentCardClasses.info)}>
          <CardTitle className="text-base font-semibold">Entradas e saídas por mês</CardTitle>
          <CardDescription>Sazonalidade da demanda</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {combined.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados</p>
          ) : (
            <AdvancedBarChart
              data={combined}
              xAxisKey="label"
              series={[
                { dataKey: "entradas", name: "Entradas", color: "#3b82f6" },
                { dataKey: "saídas", name: "Saídas", color: "#f59e0b" },
              ]}
              formatValue={formatCount}
              yAxisFormatter={(v) => String(v)}
              height={280}
              maxBarSize={40}
              barGap={10}
              emptyMessage="Sem dados"
            />
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
        <CardHeader className={cn("border-b border-border/50", accentCardClasses.info)}>
          <CardTitle className="text-base font-semibold">Saldo líquido (entradas − saídas)</CardTitle>
          <CardDescription>Períodos com maior ocupação vs vacância</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {combined.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados</p>
          ) : (
            <AdvancedBarChart
              data={combined}
              xAxisKey="label"
              series={[
                {
                  dataKey: "saldo",
                  name: "Saldo",
                  color: dataColors.info,
                },
              ]}
              formatValue={formatCount}
              yAxisFormatter={(v) => String(v)}
              height={280}
              maxBarSize={44}
              allowNegative
              emptyMessage="Sem dados"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
