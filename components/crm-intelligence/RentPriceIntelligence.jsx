"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { accentCardClasses } from "@/lib/chartColors";

export function RentPriceIntelligence({
  occupancyRate = 0,
  entriesByMonth = [],
  exitsByMonth = [],
  empty = 0,
  totalKitnets = 12,
}) {
  const lastMonths = entriesByMonth.slice(-3);
  const avgEntries = lastMonths.length
    ? lastMonths.reduce((s, m) => s + (m.count || 0), 0) / lastMonths.length
    : 0;
  const highDemand = avgEntries >= 2 || occupancyRate >= 90;
  const lowDemand = empty >= 4 || occupancyRate < 60;
  const suggestion =
    highDemand && occupancyRate > 80
      ? "Alta demanda e ocupação. Momento favorável para reajuste de aluguel."
      : lowDemand
        ? "Demanda ou ocupação baixa. Evite reajustes agressivos para reduzir vacância."
        : "Demanda estável. Avalie reajuste conforme índice (ex.: IGP-M) e mercado.";

  return (
    <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
      <CardHeader className="border-b border-border/50 bg-muted/20">
        <CardTitle className="text-base font-semibold">Inteligência de preço de aluguel</CardTitle>
        <CardDescription>Quando aumentar ou manter o valor</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className={cn(
            "flex items-start gap-3 rounded-lg border border-border p-4",
            highDemand && "border-emerald-500/30 bg-emerald-500/5",
            lowDemand && "border-amber-500/30 bg-amber-500/5",
            !highDemand && !lowDemand && accentCardClasses.info
          )}>
            {highDemand ? (
              <TrendingUp className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : lowDemand ? (
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            ) : (
              <Info className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
            )}
            <div>
              <p
                className={cn(
                  "font-medium",
                  highDemand && "text-emerald-700 dark:text-emerald-400",
                  lowDemand && "text-amber-700 dark:text-amber-400"
                )}
              >
                {highDemand
                  ? "Alta demanda detectada"
                  : lowDemand
                    ? "Demanda ou ocupação baixa"
                    : "Demanda estável"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{suggestion}</p>
            </div>
          </div>
          <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <li>• Taxa de ocupação atual: <strong className="text-foreground">{occupancyRate}%</strong></li>
            <li>• Unidades vazias: <strong className="text-foreground">{empty}</strong> de {totalKitnets}</li>
            <li>• Média de entradas (últimos 3 meses): <strong className="text-foreground">{avgEntries.toFixed(1)}</strong></li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
