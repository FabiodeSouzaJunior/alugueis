"use client";

import { useMemo } from "react";
import { Droplets, Zap, TrendingUp, TrendingDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { AlertCard } from "@/components/dashboard/AlertCard";

const ANOMALY_THRESHOLD_PCT = 30;
const ANOMALY_ABOVE_AVG_FACTOR = 1.5;

function formatConsumption(value) {
  return Number(value).toFixed(2).replace(".", ",");
}

export function ConsumptionInsights({
  tenants = [],
  consumptions = [],
  tableRows = [],
  currentMonth,
  currentYear,
}) {
  const currentRows = useMemo(
    () => tableRows.filter((r) => r.total > 0 || r.water > 0 || r.electricity > 0),
    [tableRows]
  );

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const analyses = useMemo(() => {
    const whoMoreWater = [...currentRows].sort((a, b) => b.water - a.water)[0];
    const whoMoreEnergy = [...currentRows].sort((a, b) => b.electricity - a.electricity)[0];
    const byIncrease = [...currentRows].filter((r) => r.variation != null).sort((a, b) => (b.variation ?? 0) - (a.variation ?? 0));
    const biggestIncrease = byIncrease[0];
    const whoReduced = [...currentRows].filter((r) => r.variation != null && r.variation < 0).sort((a, b) => (a.variation ?? 0) - (b.variation ?? 0))[0];

    const totalCurrent = currentRows.reduce((s, r) => s + r.total, 0);
    const count = currentRows.length || 1;
    const avgCurrent = totalCurrent / count;

    const lastTwoMonthsTotal = consumptions
      .filter((c) => {
        const y = c.year;
        const m = c.month;
        if (y === currentYear && m === currentMonth) return false;
        if (y === prevYear && m === prevMonth) return true;
        const prevPrevMonth = prevMonth === 1 ? 12 : prevMonth - 1;
        const prevPrevYear = prevMonth === 1 ? prevYear - 1 : prevYear;
        return y === prevPrevYear && m === prevPrevMonth;
      })
      .reduce((s, c) => s + (Number(c.waterUsage) || 0) + (Number(c.electricityUsage) || 0), 0);

    const allMonthsCount = consumptions.length || 1;
    const annualTotal = consumptions.reduce(
      (s, c) => s + (Number(c.waterUsage) || 0) + (Number(c.electricityUsage) || 0),
      0
    );
    const avgAnnual = annualTotal / allMonthsCount;

    return {
      whoMoreWater,
      whoMoreEnergy,
      biggestIncrease,
      whoReduced,
      totalCurrent,
      avgCurrent,
      lastTwoMonthsTotal,
      avgAnnual,
      countMonths: consumptions.length,
    };
  }, [currentRows, consumptions, currentMonth, currentYear, prevMonth, prevYear]);

  const insightPhrases = useMemo(() => {
    const list = [];
    if (analyses.whoMoreWater) {
      list.push(
        `${analyses.whoMoreWater.tenant?.name ?? "Inquilino"} possui o maior consumo de água no mês (${formatConsumption(analyses.whoMoreWater.water)}).`
      );
    }
    if (analyses.whoMoreEnergy) {
      list.push(
        `${analyses.whoMoreEnergy.tenant?.name ?? "Inquilino"} possui o maior consumo de energia no mês (${formatConsumption(analyses.whoMoreEnergy.electricity)}).`
      );
    }
    if (analyses.biggestIncrease && analyses.biggestIncrease.variation > 0) {
      list.push(
        `Inquilino ${analyses.biggestIncrease.tenant?.name ?? "—"} aumentou o consumo em ${analyses.biggestIncrease.variation.toFixed(1)}% em relação ao mês anterior.`
      );
    }
    if (analyses.whoReduced) {
      list.push(
        `Inquilino ${analyses.whoReduced.tenant?.name ?? "—"} reduziu o consumo em ${Math.abs(analyses.whoReduced.variation).toFixed(1)}% em relação ao mês anterior.`
      );
    }
    if (analyses.countMonths > 0 && analyses.avgAnnual > 0) {
      const diffPct = ((analyses.totalCurrent - analyses.avgAnnual) / analyses.avgAnnual) * 100;
      list.push(
        `Consumo total do mês atual ${diffPct >= 0 ? "está " + diffPct.toFixed(1) + "% acima" : "está " + Math.abs(diffPct).toFixed(1) + "% abaixo"} da média mensal do histórico.`
      );
    }
    return list;
  }, [analyses]);

  const anomalyAlerts = useMemo(() => {
    const alerts = [];
    currentRows.forEach((r) => {
      if (r.variation != null && r.variation > ANOMALY_THRESHOLD_PCT) {
        alerts.push({
          type: "high_increase",
          message: `${r.tenant?.name ?? "Inquilino"} aumentou consumo em ${r.variation.toFixed(1)}% em relação ao mês anterior.`,
          tenantId: r.tenant?.id,
        });
      }
      const avg = analyses.avgCurrent > 0 ? analyses.avgCurrent : 1;
      if (r.total > avg * ANOMALY_ABOVE_AVG_FACTOR && r.total > 0) {
        alerts.push({
          type: "above_average",
          message: `${r.tenant?.name ?? "Inquilino"} está com consumo total (${formatConsumption(r.total)}) bem acima da média (${formatConsumption(avg)}).`,
          tenantId: r.tenant?.id,
        });
      }
    });
    return alerts;
  }, [currentRows, analyses.avgCurrent]);

  return (
    <section>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Análises e insights
      </h2>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Resumos calculados</CardTitle>
            <CardDescription>Quem mais consome, maiores variações e comparações</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analyses.whoMoreWater && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                <Droplets className="h-4 w-4 text-blue-500" />
                <span className="text-sm">
                  Quem mais consome água: <strong>{analyses.whoMoreWater.tenant?.name}</strong> ({formatConsumption(analyses.whoMoreWater.water)})
                </span>
              </div>
            )}
            {analyses.whoMoreEnergy && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="text-sm">
                  Quem mais consome energia: <strong>{analyses.whoMoreEnergy.tenant?.name}</strong> ({formatConsumption(analyses.whoMoreEnergy.electricity)})
                </span>
              </div>
            )}
            {analyses.biggestIncrease && analyses.biggestIncrease.variation > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-amber-500/5 px-3 py-2">
                <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm">
                  Maior aumento de consumo: <strong>{analyses.biggestIncrease.tenant?.name}</strong> (+{analyses.biggestIncrease.variation.toFixed(1)}%)
                </span>
              </div>
            )}
            {analyses.whoReduced && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-emerald-500/5 px-3 py-2">
                <TrendingDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm">
                  Quem reduziu consumo: <strong>{analyses.whoReduced.tenant?.name}</strong> ({analyses.whoReduced.variation.toFixed(1)}%)
                </span>
              </div>
            )}
            {currentRows.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum dado do mês atual para análises.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Insights automáticos</CardTitle>
            <CardDescription>Frases geradas a partir dos dados do período</CardDescription>
          </CardHeader>
          <CardContent>
            {insightPhrases.length > 0 ? (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {insightPhrases.map((phrase, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{phrase}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum insight disponível para o período.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {anomalyAlerts.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Alertas de consumo</h3>
          <div className="flex flex-wrap gap-3">
            {anomalyAlerts.map((alert, i) => (
              <AlertCard
                key={`${alert.tenantId}-${alert.type}-${i}`}
                title="Anomalia"
                description={alert.message}
                severity="warning"
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
