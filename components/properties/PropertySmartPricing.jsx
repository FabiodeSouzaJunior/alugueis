"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InsightCard } from "@/components/ui/insight-card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, TrendingDown, Lightbulb, Calculator } from "lucide-react";
import { accentCardClasses } from "@/lib/chartColors";
import { cn } from "@/lib/utils";

const ADJUSTMENT_OPTIONS = [
  { value: 5, label: "+5%" },
  { value: 8, label: "+8%" },
  { value: 10, label: "+10%" },
  { value: -5, label: "-5%" },
  { value: -8, label: "-8%" },
  { value: -10, label: "-10%" },
];

function propertyTotalRent(p) {
  const units = p.units || [];
  return units.reduce((s, u) => s + (Number(u.rentPrice) || 0), 0);
}

export function PropertySmartPricing({ properties = [], formatCurrency }) {
  const [applyToAll, setApplyToAll] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [adjustmentPct, setAdjustmentPct] = useState("8");

  const propertiesWithRent = useMemo(
    () => properties
      .map((p) => ({ ...p, totalRent: propertyTotalRent(p) }))
      .filter((p) => p.totalRent > 0),
    [properties]
  );

  const totalMaxPeople = useMemo(
    () => properties.reduce((s, p) => s + (p.maxPeople || 0), 0),
    [properties]
  );
  const totalCurrentPeople = useMemo(
    () => properties.reduce((s, p) => s + (p.currentPeople || 0), 0),
    [properties]
  );
  const occupancyRate = totalMaxPeople > 0
    ? Math.round((totalCurrentPeople / totalMaxPeople) * 100)
    : 0;

  const occupiedCount = useMemo(
    () => properties.filter((p) => (p.currentPeople || 0) > 0).length,
    [properties]
  );
  const totalUnits = useMemo(
    () => properties.reduce((s, p) => s + (p.unitCount || 0), 0),
    [properties]
  );
  const unitOccupancyRate = totalUnits > 0 && properties.length > 0
    ? Math.round((occupiedCount / Math.max(1, properties.length)) * 100)
    : 0;

  const insights = useMemo(() => {
    const list = [];
    if (occupancyRate >= 95 && properties.length > 0) {
      list.push({
        type: "increase",
        message: `A ocupação está acima de 95% (${occupancyRate}%). Recomenda-se aumentar os aluguéis em aproximadamente 6%.`,
        accent: "revenue",
      });
    }
    if (occupancyRate < 70 && totalMaxPeople > 0) {
      list.push({
        type: "decrease",
        message: "A vacância está elevada. Reduzir o preço pode ajudar a aumentar a ocupação.",
        accent: "warning",
      });
    }
    const avgRent = propertiesWithRent.length > 0
      ? propertiesWithRent.reduce((s, p) => s + (p.totalRent || 0), 0) / propertiesWithRent.length
      : 0;
    const withRentBelowAvg = propertiesWithRent.filter((p) => (p.totalRent || 0) < avgRent && avgRent > 0);
    if (withRentBelowAvg.length > 0 && propertiesWithRent.length > 1) {
      list.push({
        type: "info",
        message: `${withRentBelowAvg.length} imóvel(is) com preço abaixo da média. Revisar pode aumentar a receita.`,
        accent: "info",
      });
    }
    if (list.length === 0 && properties.length > 0) {
      list.push({
        type: "neutral",
        message: "Informe o preço do aluguel nos imóveis para receber recomendações baseadas em ocupação e receita.",
        accent: "neutral",
      });
    }
    return list;
  }, [occupancyRate, totalMaxPeople, properties.length, propertiesWithRent]);

  const idsForSimulation = applyToAll
    ? propertiesWithRent.map((p) => p.id)
    : selectedIds;
  const currentMonthlyRevenue = useMemo(() => {
    if (applyToAll) {
      return propertiesWithRent.reduce((s, p) => s + (Number(p.totalRent) || 0), 0);
    }
    return properties
      .filter((p) => selectedIds.includes(p.id))
      .reduce((s, p) => s + (Number(propertyTotalRent(p)) || 0), 0);
  }, [properties, propertiesWithRent, applyToAll, selectedIds]);
  const pct = Number(adjustmentPct) || 0;
  const newMonthlyRevenue = currentMonthlyRevenue * (1 + pct / 100);
  const diffMonthly = newMonthlyRevenue - currentMonthlyRevenue;
  const diffYearly = diffMonthly * 12;

  const toggleProperty = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
        <CardHeader className={cn("border-b border-border/50", accentCardClasses.property)}>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
            <CardTitle className="text-base font-semibold">Sugestão Inteligente de Preço</CardTitle>
          </div>
          <CardDescription>
            Recomendações com base em ocupação, sazonalidade e histórico. Simule cenários de ajuste de aluguel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {insights.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Recomendações automáticas
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {insights.map((item, i) => (
                  <InsightCard
                    key={i}
                    icon={item.type === "increase" ? TrendingUp : item.type === "decrease" ? TrendingDown : Lightbulb}
                    title={item.type === "increase" ? "Aumento sugerido" : item.type === "decrease" ? "Atenção à vacância" : "Análise"}
                    accent={item.accent}
                  >
                    {item.message}
                  </InsightCard>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Calculator className="h-4 w-4" />
              Simulador de cenários de preço
            </h3>
            <div className="grid gap-6 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-1 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Selecionar imóveis</Label>
                  <Select
                    value={applyToAll ? "all" : "specific"}
                    onValueChange={(v) => {
                      setApplyToAll(v === "all");
                      if (v === "all") setSelectedIds([]);
                      else setSelectedIds(properties.map((p) => p.id));
                    }}
                  >
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Aplicar em todos os imóveis com preço informado</SelectItem>
                      <SelectItem value="specific">Selecionar imóveis específicos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!applyToAll && properties.length > 0 && (
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-2">
                    <p className="text-xs text-muted-foreground mb-2">
                      Marque os imóveis que deseja incluir na simulação. Todos os imóveis cadastrados aparecem abaixo.
                    </p>
                    {properties.map((p) => {
                      const totalRent = propertyTotalRent(p);
                      return (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(p.id)}
                            onChange={() => toggleProperty(p.id)}
                            className="h-4 w-4 rounded border-input"
                          />
                          <span className="truncate">{p.name}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {formatCurrency(totalRent)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Ajuste de preço</Label>
                  <Select value={adjustmentPct} onValueChange={setAdjustmentPct}>
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ADJUSTMENT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">Receita atual mensal</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                    {formatCurrency(currentMonthlyRevenue)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Simulação com {Number(adjustmentPct) >= 0 ? "aumento" : "redução"} de {Math.abs(Number(adjustmentPct) || 0)}%
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                    {formatCurrency(newMonthlyRevenue)}
                  </p>
                  <p className="text-xs text-muted-foreground">Nova receita mensal</p>
                </div>
                <div
                  className={cn(
                    "rounded-xl border p-4",
                    diffMonthly >= 0
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-red-500/30 bg-red-500/5"
                  )}
                >
                  <p className="text-xs font-medium text-muted-foreground">Diferença</p>
                  <p
                    className={cn(
                      "mt-1 text-xl font-bold tabular-nums",
                      diffMonthly >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {formatCurrency(diffMonthly)} por mês
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatCurrency(diffYearly)} por ano
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
