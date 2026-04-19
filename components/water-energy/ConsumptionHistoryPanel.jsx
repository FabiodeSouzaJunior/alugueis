"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContentWithClose,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AdvancedBarChart } from "@/components/charts/AdvancedBarChart";
import { dataColors, accentCardClasses } from "@/lib/chartColors";
import { getMonthName } from "@/lib/utils";
import { ChevronDown, ChevronRight, List } from "lucide-react";
import { cn } from "@/lib/utils";

function formatConsumption(value) {
  return Number(value).toFixed(2).replace(".", ",");
}

export function ConsumptionHistoryPanel({
  tenant,
  consumptionRecords = [],
  onClose,
  onRefresh,
}) {
  const [historyTableExpanded, setHistoryTableExpanded] = useState(false);

  const tableData = useMemo(() => {
    return [...consumptionRecords]
      .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month))
      .map((c) => ({
        period: `${getMonthName(c.month)} ${c.year}`,
        month: c.month,
        year: c.year,
        water: Number(c.waterUsage) || 0,
        electricity: Number(c.electricityUsage) || 0,
        total: (Number(c.waterUsage) || 0) + (Number(c.electricityUsage) || 0),
      }));
  }, [consumptionRecords]);

  const barChartData = useMemo(() => {
    return tableData.map((d) => ({
      name: `${getMonthName(d.month).slice(0, 3)}/${String(d.year).slice(-2)}`,
      água: d.water,
      luz: d.electricity,
    }));
  }, [tableData]);

  const lineChartData = useMemo(() => {
    return tableData.map((d) => ({
      period: `${getMonthName(d.month).slice(0, 3)}/${d.year}`,
      total: d.total,
    }));
  }, [tableData]);

  return (
    <Dialog open={!!tenant} onOpenChange={(open) => !open && onClose()}>
      <DialogContentWithClose
        className="max-h-[90vh] max-w-4xl overflow-y-auto"
        title={tenant ? `Histórico — ${tenant.name}` : "Histórico"}
        onClose={onClose}
      >
        <div className="space-y-6">
          <Card className="rounded-xl border border-border shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setHistoryTableExpanded((v) => !v)}
              className={cn(
                "w-full flex items-center gap-3 p-4 sm:p-5 text-left transition-colors",
                "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "border-b border-border/50",
                historyTableExpanded && "bg-muted/20 border-b border-border"
              )}
              aria-expanded={historyTableExpanded}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <List className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base flex items-center gap-2">
                  Tabela de registros por mês
                  <span className="text-muted-foreground font-normal text-sm">
                    — Clique para {historyTableExpanded ? "recolher" : "ver a tabela"}
                  </span>
                </CardTitle>
                <CardDescription className="mt-0.5">
                  {historyTableExpanded
                    ? "Mês/ano, consumo de água, luz e total."
                    : "Ver todos os meses com consumo de água, luz e total. Clique para expandir."}
                </CardDescription>
              </div>
              <span className="shrink-0 text-muted-foreground" aria-hidden>
                {historyTableExpanded ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </span>
            </button>
            {historyTableExpanded && (
              <div className="overflow-x-auto border-t border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês/Ano</TableHead>
                      <TableHead className="text-right">Água</TableHead>
                      <TableHead className="text-right">Luz</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhum registro de consumo.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tableData.map((row) => (
                        <TableRow key={`${row.year}-${row.month}`}>
                          <TableCell className="font-medium">{row.period}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatConsumption(row.water)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatConsumption(row.electricity)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{formatConsumption(row.total)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          {barChartData.length > 0 && (
            <Card className="rounded-xl border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Água vs Luz por mês</CardTitle>
                <CardDescription>Consumo de água e energia ao longo do tempo</CardDescription>
              </CardHeader>
              <CardContent>
                <AdvancedBarChart
                  data={barChartData}
                  xAxisKey="name"
                  series={[
                    { dataKey: "água", name: "Água", color: "#3b82f6" },
                    { dataKey: "luz", name: "Luz", color: "#f59e0b" },
                  ]}
                  formatValue={(v) => formatConsumption(v)}
                  height={280}
                  yAxisFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                />
              </CardContent>
            </Card>
          )}

          {lineChartData.length > 0 && (
            <Card className="rounded-xl border border-border shadow-sm">
              <CardHeader className={cn("border-b border-border/50", accentCardClasses.info)}>
                <CardTitle className="text-base">Evolução do total</CardTitle>
                <CardDescription>Consumo total (água + luz) por período</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={lineChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                        labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke={dataColors.info}
                        fill={dataColors.info}
                        fillOpacity={0.22}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContentWithClose>
    </Dialog>
  );
}
