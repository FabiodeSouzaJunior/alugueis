"use client";

import { useMemo } from "react";
import { Droplets, Zap, Users, TrendingUp, TrendingDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatsCard } from "@/components/reports/StatsCard";
import { AdvancedBarChart } from "@/components/charts/AdvancedBarChart";
import { ChartCard } from "@/components/cards/ChartCard";
import { dataColors } from "@/lib/chartColors";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getMonthName } from "@/lib/utils";

function formatConsumption(value) {
  return Number(value).toFixed(2).replace(".", ",");
}

export function ConsumptionDashboard({
  tenants = [],
  consumptions = [],
  tableRows = [],
  currentMonth,
  currentYear,
  loading,
}) {
  const currentRows = useMemo(
    () => tableRows.filter((r) => r.total > 0 || r.water > 0 || r.electricity > 0),
    [tableRows]
  );

  const totals = useMemo(() => {
    let totalWater = 0;
    let totalElectricity = 0;
    currentRows.forEach((r) => {
      totalWater += r.water;
      totalElectricity += r.electricity;
    });
    const totalCombined = totalWater + totalElectricity;
    const count = currentRows.length || 1;
    return {
      totalWater,
      totalElectricity,
      totalCombined,
      avgPerTenant: totalCombined / count,
      count,
    };
  }, [currentRows]);

  const biggestConsumer = useMemo(() => {
    if (currentRows.length === 0) return null;
    return currentRows.reduce((best, r) => (r.total > (best?.total ?? 0) ? r : best), currentRows[0]);
  }, [currentRows]);

  const smallestConsumer = useMemo(() => {
    const withConsumption = currentRows.filter((r) => r.total > 0);
    if (withConsumption.length === 0) return null;
    return withConsumption.reduce((best, r) => (r.total < (best?.total ?? Infinity) ? r : best), withConsumption[0]);
  }, [currentRows]);

  const chartByTenant = useMemo(() => {
    return currentRows
      .map((r) => ({
        name: r.tenant?.name?.slice(0, 12) ?? String(r.tenant?.kitnetNumber ?? "—"),
        total: r.total,
        water: r.water,
        electricity: r.electricity,
      }))
      .filter((d) => d.total > 0);
  }, [currentRows]);

  const chartByYear = useMemo(() => {
    const byPeriod = {};
    consumptions.forEach((c) => {
      const key = `${c.year}-${c.month}`;
      if (!byPeriod[key]) byPeriod[key] = { period: "", year: c.year, month: c.month, total: 0 };
      byPeriod[key].total += (Number(c.waterUsage) || 0) + (Number(c.electricityUsage) || 0);
      byPeriod[key].period = `${getMonthName(c.month).slice(0, 3)}/${c.year}`;
    });
    return Object.values(byPeriod).sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
  }, [consumptions]);

  const waterVsLightByMonth = useMemo(() => {
    const byPeriod = {};
    consumptions.forEach((c) => {
      const key = `${c.year}-${c.month}`;
      if (!byPeriod[key]) {
        byPeriod[key] = {
          period: "",
          year: c.year,
          month: c.month,
          water: 0,
          electricity: 0,
        };
      }
      byPeriod[key].water += Number(c.waterUsage) || 0;
      byPeriod[key].electricity += Number(c.electricityUsage) || 0;
      byPeriod[key].period = `${getMonthName(c.month).slice(0, 3)}/${c.year}`;
    });

    return Object.values(byPeriod)
      .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
      .map((d) => ({ period: d.period, water: d.water, electricity: d.electricity }));
  }, [consumptions]);

  const seasonalityByMonth = useMemo(() => {
    const byMonth = {};
    consumptions.forEach((c) => {
      const key = c.month;
      if (!byMonth[key]) byMonth[key] = { month: key, name: getMonthName(key), total: 0 };
      byMonth[key].total += (Number(c.waterUsage) || 0) + (Number(c.electricityUsage) || 0);
    });
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => ({
      name: getMonthName(m).slice(0, 3),
      total: byMonth[m]?.total ?? 0,
    }));
  }, [consumptions]);

  const top5Water = useMemo(() => {
    return [...currentRows]
      .filter((r) => (r.water ?? 0) > 0)
      .sort((a, b) => (b.water ?? 0) - (a.water ?? 0))
      .slice(0, 5);
  }, [currentRows]);

  const top5Electricity = useMemo(() => {
    return [...currentRows]
      .filter((r) => (r.electricity ?? 0) > 0)
      .sort((a, b) => (b.electricity ?? 0) - (a.electricity ?? 0))
      .slice(0, 5);
  }, [currentRows]);

  const top5Increasing = useMemo(() => {
    return [...currentRows]
      .filter((r) => r.variation != null && r.variation > 0)
      .sort((a, b) => (b.variation ?? 0) - (a.variation ?? 0))
      .slice(0, 5);
  }, [currentRows]);

  const top5Saving = useMemo(() => {
    return [...currentRows]
      .filter((r) => r.variation != null && r.variation < 0)
      .sort((a, b) => (a.variation ?? 0) - (b.variation ?? 0))
      .slice(0, 5);
  }, [currentRows]);

  function TopList({ items, formatRow, accent }) {
    const accentStyles = {
      info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      energy: "bg-amber-400/10 text-amber-600 dark:text-amber-500",
      expense: "bg-red-500/10 text-red-600 dark:text-red-400",
      revenue: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    };
    const badgeClass = accentStyles[accent] || accentStyles.info;
    if (!items?.length) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum dado no período.</p>
      );
    }
    return (
      <ul className="space-y-2">
        {items.map((row, index) => (
          <li
            key={row.tenant?.id ?? index}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/10 px-3 py-2.5"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badgeClass}`}
              >
                {index + 1}
              </span>
              <span className="truncate font-medium text-foreground">
                {row.tenant?.name ?? "—"}
              </span>
            </div>
            <span className="shrink-0 font-semibold tabular-nums text-foreground">
              {formatRow(row)}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (loading) {
    return (
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Dashboard analítico
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-muted/30" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Dashboard analítico
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatsCard
          title="Consumo total de água (mês)"
          value={formatConsumption(totals.totalWater)}
          description="Soma de todos os inquilinos"
          icon={Droplets}
          accent="info"
        />
        <StatsCard
          title="Consumo total de luz (mês)"
          value={formatConsumption(totals.totalElectricity)}
          description="Soma de todos os inquilinos"
          icon={Zap}
          accent="energy"
        />
        <StatsCard
          title="Média por inquilino"
          value={formatConsumption(totals.avgPerTenant)}
          description={`${totals.count} inquilino(s) com registro`}
          icon={Users}
          accent="info"
        />
        <StatsCard
          title="Maior consumidor do mês"
          value={biggestConsumer ? (biggestConsumer.tenant?.name ?? "—") : "—"}
          description={biggestConsumer ? formatConsumption(biggestConsumer.total) : "Sem dados"}
          icon={TrendingUp}
          accent="info"
        />
        <StatsCard
          title="Menor consumidor do mês"
          value={smallestConsumer ? (smallestConsumer.tenant?.name ?? "—") : "—"}
          description={smallestConsumer ? formatConsumption(smallestConsumer.total) : "Sem dados"}
          icon={TrendingDown}
          accent="info"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Consumo por inquilino"
          description="Água e luz no mês atual (por inquilino)"
          accent="info"
        >
          {chartByTenant.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              Nenhum dado para exibir
            </div>
          ) : (
            <AdvancedBarChart
              data={chartByTenant}
              xAxisKey="name"
              series={[
                { dataKey: "water", name: "Água", color: "#3b82f6" },
                { dataKey: "electricity", name: "Luz", color: "#f59e0b" },
              ]}
              formatValue={formatConsumption}
              height={280}
              yAxisFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Consumo ao longo do tempo"
          description="Evolução mensal do total geral"
          accent="expense"
        >
          {chartByYear.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              Nenhum dado para exibir
            </div>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartByYear} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" strokeOpacity={0.35} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                  />
                  <Tooltip
                    formatter={(value) => [formatConsumption(value), "Total"]}
                    contentStyle={{
                      backgroundColor: "hsl(0 0% 9% / 0.96)",
                      border: "none",
                      borderRadius: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke={dataColors.expense}
                    fill={dataColors.expense}
                    fillOpacity={0.22}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Água vs Luz (por mês)"
          description="Comparativo total de água e luz ao longo dos meses"
          accent="info"
        >
          {waterVsLightByMonth.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              Nenhum dado para exibir
            </div>
          ) : (
            <AdvancedBarChart
              data={waterVsLightByMonth}
              xAxisKey="period"
              series={[
                { dataKey: "water", name: "Água", color: "#3b82f6" },
                { dataKey: "electricity", name: "Luz", color: "#f59e0b" },
              ]}
              formatValue={formatConsumption}
              height={280}
              yAxisFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Sazonalidade"
          description="Total por mês (histórico)"
          accent="expense"
        >
          <AdvancedBarChart
            data={seasonalityByMonth}
            xAxisKey="name"
            series={[{ dataKey: "total", name: "Total", color: dataColors.expense }]}
            formatValue={formatConsumption}
            height={280}
            yAxisFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
            emptyMessage="Nenhum dado para exibir"
          />
        </ChartCard>
      </div>

      <div className="mt-8">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Rankings e tendências
        </h3>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <ChartCard
            title="Top 5 que mais gastam água"
            description="Maior consumo de água no mês atual"
            accent="info"
          >
            <TopList
              items={top5Water}
              formatRow={(row) => formatConsumption(row.water)}
              accent="info"
            />
          </ChartCard>
          <ChartCard
            title="Top 5 que mais gastam luz"
            description="Maior consumo de energia no mês atual"
            accent="energy"
          >
            <TopList
              items={top5Electricity}
              formatRow={(row) => formatConsumption(row.electricity)}
              accent="energy"
            />
          </ChartCard>
          <ChartCard
            title="Top 5 que mais aumentaram o consumo"
            description="Maior alta em relação ao mês anterior"
            accent="expense"
          >
            <TopList
              items={top5Increasing}
              formatRow={(row) =>
                `${row.variation >= 0 ? "+" : ""}${Number(row.variation).toFixed(1).replace(".", ",")}%`
              }
              accent="expense"
            />
          </ChartCard>
          <ChartCard
            title="Top 5 que mais economizaram"
            description="Maior redução em relação ao mês anterior"
            accent="revenue"
          >
            <TopList
              items={top5Saving}
              formatRow={(row) =>
                `${Number(row.variation).toFixed(1).replace(".", ",")}%`
              }
              accent="revenue"
            />
          </ChartCard>
        </div>
      </div>
    </section>
  );
}
