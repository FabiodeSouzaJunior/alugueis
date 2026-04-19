"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, getMonthName } from "@/lib/utils";
import { getCurrentMonthYear } from "@/lib/calculations";
import { fetchObra, fetchObraCosts, fetchObraWorkers } from "@/lib/api";
import { ObraStatsCard } from "@/components/obra-reports/ObraStatsCard";
import { ObraFinancialProgress } from "@/components/obra-reports/ObraFinancialProgress";
import {
  ObraCostsByCategoryChart,
  ObraCostsEvolutionChart,
} from "@/components/obra-reports/ObraCostsChart";
import { ObraCostsAccordion } from "@/components/obra-reports/ObraCostsAccordion";
import { ObraResumoGeral } from "@/components/obra-reports/ObraResumoGeral";
import { ObraCustoPorTrabalhador } from "@/components/obra-reports/ObraCustoPorTrabalhador";
import { DollarSign, Target, Wallet, Ruler, Sparkles, ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const COST_CATEGORIES = ["Material", "Mão de obra", "Ferramentas", "Projeto", "Taxas", "Outros"];

const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

function shiftMonth(month, year, delta) {
  const idx = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(idx / 12);
  const newMonth = (idx % 12) + 1;
  return { month: newMonth, year: newYear };
}

export default function ObraDashboardPage() {
  const params = useParams();
  const id = params?.id;
  const [obra, setObra] = useState(null);
  const [costs, setCosts] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  const { month: todayMonth, year: todayYear } = getCurrentMonthYear();
  const [reportMonth, setReportMonth] = useState(todayMonth);
  const [reportYear, setReportYear] = useState(todayYear);

  const periodLabel = (() => {
    if (reportMonth == null && reportYear == null) return "Todos os períodos";
    if (reportMonth == null) return `Todos os meses ${reportYear}`;
    if (reportYear == null) return `${getMonthName(reportMonth)} (todos os anos)`;
    return `${getMonthName(reportMonth)} ${reportYear}`;
  })();

  const canNavigateMonth = reportMonth != null && reportYear != null;
  const isCurrentPeriod = canNavigateMonth && reportMonth === todayMonth && reportYear === todayYear;

  const goPrev = () => {
    if (!canNavigateMonth) return;
    const n = shiftMonth(reportMonth, reportYear, -1);
    setReportMonth(n.month);
    setReportYear(n.year);
  };

  const goNext = () => {
    if (!canNavigateMonth) return;
    const n = shiftMonth(reportMonth, reportYear, 1);
    setReportMonth(n.month);
    setReportYear(n.year);
  };

  const goCurrent = () => {
    setReportMonth(todayMonth);
    setReportYear(todayYear);
  };

  const periodSelectClass = "period-select-trigger h-10 w-full min-w-0";

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchObra(id),
      fetchObraCosts(id),
      fetchObraWorkers(id),
    ])
      .then(([o, c, w]) => {
        setObra(o);
        setCosts(Array.isArray(c) ? c : []);
        setWorkers(Array.isArray(w) ? w : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const yearOptions = useMemo(() => {
    const set = new Set();
    (costs || []).forEach((c) => {
      const y = c?.date ? Number(String(c.date).slice(0, 4)) : null;
      if (y != null && !Number.isNaN(y)) set.add(y);
    });
    const years = [...set].sort((a, b) => a - b);
    if (years.length === 0) {
      const base = todayYear - 2;
      return Array.from({ length: 6 }, (_, i) => base + i);
    }
    if (!years.includes(todayYear)) years.push(todayYear);
    return years.sort((a, b) => a - b);
  }, [costs, todayYear]);

  const filteredCosts = useMemo(() => {
    const list = Array.isArray(costs) ? costs : [];
    if (reportMonth == null && reportYear == null) return list;

    return list.filter((c) => {
      if (!c?.date) return false;
      const y = Number(String(c.date).slice(0, 4));
      const m = Number(String(c.date).slice(5, 7));
      if (reportMonth == null) return y === Number(reportYear);
      if (reportYear == null) return m === Number(reportMonth);
      return y === Number(reportYear) && m === Number(reportMonth);
    });
  }, [costs, reportMonth, reportYear]);

  const isPeriodFiltered = reportMonth != null || reportYear != null;

  const report = useMemo(() => {
    const allCostsList = Array.isArray(costs) ? costs : [];
    const costTotal = allCostsList.reduce((s, x) => s + (Number(x.value) || 0), 0);
    const budget = obra ? Number(obra.budget) || 0 : 0;
    const remaining = Math.max(0, budget - costTotal);
    const areaM2 = obra?.areaM2 != null ? Number(obra.areaM2) : null;
    const costPerM2 = areaM2 && areaM2 > 0 ? costTotal / areaM2 : null;
    const costPeriod = filteredCosts.reduce((s, x) => s + (Number(x.value) || 0), 0);

    const byCategory = {};
    filteredCosts.forEach((c) => {
      const cat = c.category || "Outros";
      byCategory[cat] = (byCategory[cat] || 0) + (Number(c.value) || 0);
    });

    const byCategoryAll = {};
    allCostsList.forEach((c) => {
      const cat = c.category || "Outros";
      byCategoryAll[cat] = (byCategoryAll[cat] || 0) + (Number(c.value) || 0);
    });

    const byWorker = workers.map((w) => {
      const totalPaid = filteredCosts.reduce((s, c) => {
        if (String(c.referenceType) !== "worker") return s;
        if (String(c.referenceId) !== String(w.id)) return s;
        return s + (Number(c.value) || 0);
      }, 0);
      return { name: w.name, role: w.role, totalPaid };
    });

    return {
      costTotal,
      costPeriod,
      budget,
      remaining,
      costPerM2,
      areaM2,
      byCategory,
      byCategoryAll,
      byWorker,
      totalMaoDeObra: byCategory["Mão de obra"] ?? 0,
      totalMaoDeObraAll: byCategoryAll["Mão de obra"] ?? 0,
    };
  }, [obra, filteredCosts, costs, workers]);

  const chartByCategory = useMemo(() => {
    return COST_CATEGORIES.map((cat) => ({
      name: cat,
      value: report.byCategoryAll[cat] || 0,
    })).filter((d) => d.value > 0);
  }, [report.byCategoryAll]);

  const yearCosts = useMemo(() => {
    const list = Array.isArray(costs) ? costs : [];
    if (reportYear == null) return list;
    return list.filter((c) => {
      if (!c?.date) return false;
      return Number(String(c.date).slice(0, 4)) === Number(reportYear);
    });
  }, [costs, reportYear]);

  const chartEvolution = useMemo(() => {
    const byMonth = {};
    yearCosts.forEach((c) => {
      const d = c.date ? c.date.slice(0, 7) : "";
      if (d) {
        byMonth[d] = (byMonth[d] || 0) + (Number(c.value) || 0);
      }
    });
    return Object.entries(byMonth)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => {
        const [y, m] = key.split("-");
        return { name: `${getMonthName(Number(m))?.slice(0, 3) || m}/${y.slice(2)}`, gasto: value };
      });
  }, [yearCosts]);

  const accordionCategories = useMemo(() => {
    return COST_CATEGORIES.map((cat) => ({
      name: cat,
      value: report.byCategoryAll[cat] || 0,
    }));
  }, [report.byCategoryAll]);

  if (loading || !obra) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      <section className="period-hero-shell relative isolate overflow-hidden rounded-[2rem] border p-[1px] shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]"
          aria-hidden
        >
          <div className="absolute -left-20 top-[-10%] h-[24rem] w-[24rem] rounded-full bg-gradient-to-br from-white/50 via-white/15 to-transparent blur-3xl dark:from-white/12 dark:via-white/[0.04] dark:to-transparent" />
          <div className="absolute -right-16 top-[-15%] h-[18rem] w-[18rem] rounded-full bg-gradient-to-bl from-white/40 via-white/12 to-transparent blur-3xl dark:from-white/[0.08] dark:via-white/[0.04] dark:to-transparent" />
          <div className="absolute bottom-[-20%] left-1/4 h-64 w-64 rounded-full bg-gradient-to-t from-white/35 via-white/10 to-transparent blur-3xl dark:from-white/[0.05] dark:via-white/[0.04] dark:to-transparent" />
          <div className="absolute left-[6%] top-[16%] h-[5.5rem] w-[5.5rem] rounded-full border border-white/50 bg-white/20 backdrop-blur-2xl dark:border-white/15 dark:bg-white/[0.06]" />
          <div className="absolute right-[15%] top-[10%] h-16 w-16 rounded-full border border-white/45 bg-white/18 backdrop-blur-xl dark:border-white/12 dark:bg-white/[0.05]" />
          <div className="absolute bottom-[18%] right-[6%] h-32 w-32 rounded-full border border-white/40 bg-gradient-to-br from-white/25 to-transparent blur-3xl dark:border-white/12 dark:bg-white/[0.06]" />
          <div className="absolute left-[38%] bottom-[6%] h-12 w-12 rounded-full border border-white/50 bg-white/22 backdrop-blur-lg dark:border-white/15 dark:bg-white/[0.05]" />
        </div>

        <div className="period-hero-inner relative rounded-[1.95rem] border px-5 py-8 backdrop-blur-2xl sm:px-8 sm:py-10">
          <div className="period-hero-nav pointer-events-auto absolute right-4 top-4 z-20 flex gap-0.5 rounded-xl border p-1 shadow-sm backdrop-blur-md sm:right-6 sm:top-6">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={goPrev}
              disabled={!canNavigateMonth}
              className="h-9 w-9 shrink-0 rounded-lg text-foreground hover:bg-white/50 dark:hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={goNext}
              disabled={!canNavigateMonth}
              className="h-9 w-9 shrink-0 rounded-lg text-foreground hover:bg-white/50 dark:hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-xl flex-1 space-y-3 lg:pr-4">
              <div className="period-hero-chip inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-foreground/40" />
                Obra por período
              </div>
              <h1 className="period-hero-title bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
                {periodLabel}
              </h1>
              <p className="period-hero-text text-sm leading-relaxed sm:text-base">
                Custos e gráficos abaixo refletem exclusivamente{" "}
                <span className="font-semibold text-foreground/90">{periodLabel}</span>.
              </p>
            </div>

            <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-end sm:gap-3">
              <div className="grid w-full grid-cols-2 gap-3 sm:w-[min(100%,17.5rem)]">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="period-filter-label text-sm font-semibold tracking-wide">
                    Mês
                  </span>
                  <Select
                    value={reportMonth == null ? "allMonths" : String(reportMonth)}
                    onValueChange={(v) => setReportMonth(v === "allMonths" ? null : parseInt(v, 10))}
                  >
                    <SelectTrigger className={periodSelectClass}>
                      <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="allMonths">Todos os meses</SelectItem>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="period-filter-label text-sm font-semibold tracking-wide">
                    Ano
                  </span>
                  <Select
                    value={reportYear == null ? "allYears" : String(reportYear)}
                    onValueChange={(v) => setReportYear(v === "allYears" ? null : parseInt(v, 10))}
                  >
                    <SelectTrigger className={periodSelectClass}>
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="allYears">Todos os anos</SelectItem>
                      {yearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={goCurrent}
                disabled={isCurrentPeriod}
                className="period-current-button h-10 whitespace-nowrap rounded-xl px-4 text-sm font-semibold hover:text-white"
              >
                Mês atual
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 1️⃣ KPIs principais */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Indicadores da obra
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ObraStatsCard
            title="Orçamento inicial"
            value={formatCurrency(report.budget)}
            description="Valor total previsto"
            icon={Target}
          />
          <ObraStatsCard
            title="Custo total"
            value={formatCurrency(report.costTotal)}
            description="Acumulado de todos os custos"
            icon={DollarSign}
            variant="negative"
          />
          <ObraStatsCard
            title="Valor restante"
            value={formatCurrency(report.remaining)}
            description="Orçamento − custo acumulado"
            icon={Wallet}
            variant="positive"
          />
          {report.areaM2 != null && report.areaM2 > 0 && (
            <ObraStatsCard
              title="Custo por m²"
              value={formatCurrency(report.costPerM2)}
              description={`Área: ${report.areaM2} m²`}
              icon={Ruler}
            />
          )}
        </div>
        {isPeriodFiltered && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ObraStatsCard
              title={`Gasto no período`}
              value={formatCurrency(report.costPeriod)}
              description={periodLabel}
              icon={Calendar}
            />
          </div>
        )}
      </section>

      {/* 2️⃣ Progresso financeiro */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Progresso financeiro
        </h2>
        <ObraFinancialProgress
          budgetLabel="Orçamento"
          budgetValue={formatCurrency(report.budget)}
          spentLabel="Gasto"
          spentValue={formatCurrency(report.costTotal)}
          remainingLabel="Restante"
          remainingValue={formatCurrency(report.remaining)}
          budgetNumeric={report.budget}
          spentNumeric={report.costTotal}
        />
      </section>

      {/* 3️⃣ Gráficos */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Distribuição por categoria</CardTitle>
            <CardDescription>
              Material, Mão de obra, Ferramentas, Projeto, Taxas, Outros
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartByCategory.length > 0 ? (
              <ObraCostsByCategoryChart data={chartByCategory} />
            ) : (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                Nenhum custo por categoria
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Evolução de gastos</CardTitle>
            <CardDescription>
              Gastos acumulados por mês
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartEvolution.length > 0 ? (
              <ObraCostsEvolutionChart data={chartEvolution} />
            ) : (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                Nenhum gasto registrado
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 4️⃣ Detalhamento — Custo por categoria (colapsável) */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Detalhamento financeiro
        </h2>
        <ObraCostsAccordion
          title="Custo por categoria"
          totalLabel="Total"
          totalValue={formatCurrency(report.costTotal)}
          categories={accordionCategories}
          formatCurrency={formatCurrency}
        />
      </section>

      {/* Custo por trabalhador e Resumo */}
      <section className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <ObraCustoPorTrabalhador
          workers={report.byWorker}
          totalMaoDeObra={report.totalMaoDeObra}
          formatCurrency={formatCurrency}
        />
        <ObraResumoGeral
          costTotal={report.costTotal}
          budget={report.budget}
          remaining={report.remaining}
          materialTotal={report.byCategoryAll["Material"] ?? 0}
          maoDeObraTotal={report.totalMaoDeObraAll}
          outrosTotal={
            report.costTotal -
            (report.byCategoryAll["Material"] ?? 0) -
            report.totalMaoDeObraAll
          }
          formatCurrency={formatCurrency}
          costsCount={costs.length}
        />
      </section>
    </div>
  );
}
