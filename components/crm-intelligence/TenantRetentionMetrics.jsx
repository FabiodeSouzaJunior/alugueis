"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Clock, RefreshCw, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { accentCardClasses, dataColors } from "@/lib/chartColors";

export function TenantRetentionMetrics({
  avgTenureMonths = 0,
  renewalRate = 0,
  entriesByMonth = [],
  exitsByMonth = [],
  activeTenants = 0,
}) {
  const turnoverRate = activeTenants > 0 && exitsByMonth.length
    ? Math.min(100, Math.round((exitsByMonth.reduce((s, m) => s + (m.count || 0), 0) / Math.max(activeTenants, 1)) * 100))
    : 0;

  const retentionData = entriesByMonth.map((e, i) => {
    const ex = exitsByMonth[i] || {};
    return {
      month: e.month || ex.month,
      entradas: e.count ?? 0,
      saídas: ex.count ?? 0,
    };
  }).filter((d) => d.month);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
        <CardHeader className={cn("border-b border-border/50", accentCardClasses.info)}>
          <CardTitle className="text-base font-semibold">Análise de retenção</CardTitle>
          <CardDescription>Tempo médio de permanência, renovação e rotatividade</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-3 gap-4">
            <div className={cn("rounded-lg border border-border p-4 text-center", accentCardClasses.info)}>
              <Clock className={cn("mx-auto mb-1 h-5 w-5", "text-blue-600 dark:text-blue-400")} />
              <p className="text-2xl font-bold tabular-nums">{avgTenureMonths}</p>
              <p className="text-xs text-muted-foreground">Meses (permanência)</p>
            </div>
            <div className={cn("rounded-lg border border-border p-4 text-center", accentCardClasses.revenue)}>
              <RefreshCw className={cn("mx-auto mb-1 h-5 w-5", "text-emerald-600 dark:text-emerald-400")} />
              <p className="text-2xl font-bold tabular-nums">{renewalRate}%</p>
              <p className="text-xs text-muted-foreground">Renovação</p>
            </div>
            <div className={cn("rounded-lg border border-border p-4 text-center", accentCardClasses.warning)}>
              <TrendingDown className={cn("mx-auto mb-1 h-5 w-5", "text-amber-600 dark:text-amber-400")} />
              <p className="text-2xl font-bold tabular-nums">{turnoverRate}%</p>
              <p className="text-xs text-muted-foreground">Rotatividade</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <CardTitle className="text-base font-semibold">Entradas vs saídas (últimos 12 meses)</CardTitle>
          <CardDescription>Base para cálculo de retenção</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {retentionData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados</p>
          ) : (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={retentionData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="retention-entradas-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={dataColors.info} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={dataColors.info} stopOpacity={0.2} />
                    </linearGradient>
                    <linearGradient id="retention-saidas-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={dataColors.neutral} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={dataColors.neutral} stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(m) => m ? String(m).slice(-2) + "/" + String(m).slice(0, 4) : ""} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar
                    dataKey="entradas"
                    name="Entradas"
                    fill="url(#retention-entradas-fill)"
                    stroke={dataColors.info}
                    strokeWidth={1.5}
                    radius={[4, 4, 0, 0]}
                    activeBar={{ fill: "url(#retention-entradas-fill)", stroke: dataColors.info, strokeWidth: 1.5 }}
                  />
                  <Bar
                    dataKey="saídas"
                    name="Saídas"
                    fill="url(#retention-saidas-fill)"
                    stroke={dataColors.neutral}
                    strokeWidth={1.5}
                    radius={[4, 4, 0, 0]}
                    activeBar={{ fill: "url(#retention-saidas-fill)", stroke: dataColors.neutral, strokeWidth: 1.5 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
