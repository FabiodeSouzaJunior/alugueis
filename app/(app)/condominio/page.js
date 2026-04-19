"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { usePageHeader } from "@/context/page-header";
import {
  fetchCondominiumOverview,
  fetchCondominiumBaseValues,
  fetchCondominiumExpenses,
  fetchProperties,
} from "@/lib/api";
import { formatCurrency, getMonthName, cn } from "@/lib/utils";
import { getCurrentMonthYear } from "@/lib/calculations";
import {
  getBaseValueForMonth,
  getExpenseContributionForMonth,
} from "@/lib/condominium-calc";
import { CondominiumDashboard } from "@/components/condominium/CondominiumDashboard";
import { CondominiumBaseValueManager } from "@/components/condominium/CondominiumBaseValueManager";
import { ExpenseSplitManager } from "@/components/condominium/ExpenseSplitManager";
import { CondominiumComposition } from "@/components/condominium/CondominiumComposition";
import { CondominiumEvolutionChart } from "@/components/condominium/CondominiumEvolutionChart";
import { CondominiumSettingsCard } from "@/components/condominium/CondominiumSettingsCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Sparkles, Building2 } from "lucide-react";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: getMonthName(i + 1),
}));

function shiftMonth(month, year, delta) {
  const d = new Date(year, month - 1 + delta, 1);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

export default function CondominioPage() {
  const { setPageHeader } = usePageHeader();
  const { month: initialMonth, year: initialYear } = useMemo(
    () => getCurrentMonthYear(),
    []
  );
  const [reportMonth, setReportMonth] = useState(initialMonth);
  const [reportYear, setReportYear] = useState(initialYear);
  const [overview, setOverview] = useState(null);
  const [baseValues, setBaseValues] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [propertiesLoaded, setPropertiesLoaded] = useState(false);

  const yearOptions = useMemo(() => {
    const cy = new Date().getFullYear();
    const out = [];
    for (let y = cy - 8; y <= cy + 1; y++) out.push(y);
    return out;
  }, []);

  useEffect(() => {
    setPageHeader({
      title: "Condomínio",
      description: "Gestão de taxas de condomínio, reajustes e rateio de obras e despesas.",
      action: null,
    });
    return () => setPageHeader({ title: null, description: null, action: null });
  }, [setPageHeader]);

  useEffect(() => {
    fetchProperties()
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        setProperties(arr);
        if (arr.length > 0 && !selectedPropertyId) {
          setSelectedPropertyId(arr[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setPropertiesLoaded(true));
  }, []);

  const loadAll = useCallback(async () => {
    if (!selectedPropertyId) return;
    setLoadError(null);
    setLoading(true);
    try {
      const [baseRes, expRes] = await Promise.all([
        fetchCondominiumBaseValues(selectedPropertyId),
        fetchCondominiumExpenses(selectedPropertyId),
      ]);
      const bv = Array.isArray(baseRes) ? baseRes : [];
      const ex = Array.isArray(expRes) ? expRes : [];
      setBaseValues(bv);
      setExpenses(ex);

      const cy = new Date().getFullYear();
      const cm = new Date().getMonth() + 1;

      if (reportMonth != null && reportYear != null) {
        const o = await fetchCondominiumOverview({
          month: reportMonth,
          year: reportYear,
          historyMonths: 24,
          propertyId: selectedPropertyId,
        });
        setOverview(o);
        return;
      }

      if (reportMonth == null && reportYear != null) {
        const Y = reportYear;
        let sumBase = 0;
        let sumExtras = 0;
        const byExpense = {};
        const activeIds = new Set();
        for (let m = 1; m <= 12; m++) {
          const b = getBaseValueForMonth(bv, m, Y);
          sumBase += b;
          let ext = 0;
          for (const e of ex) {
            const p = getExpenseContributionForMonth(e, m, Y);
            ext += p;
            if (p > 0) activeIds.add(e.id);
            byExpense[e.name] = (byExpense[e.name] || 0) + p;
          }
          sumExtras += ext;
        }
        const composition = [{ label: "Condomínio base (média mensal)", value: sumBase / 12 }];
        for (const e of ex) {
          const v = (byExpense[e.name] || 0) / 12;
          if (v > 0) composition.push({ label: `${e.name} (média mensal)`, value: v });
        }
        const billingHistory = [];
        for (let m = 1; m <= 12; m++) {
          const b = getBaseValueForMonth(bv, m, Y);
          let ext = 0;
          for (const e of ex) ext += getExpenseContributionForMonth(e, m, Y);
          billingHistory.push({
            month: m,
            year: Y,
            periodLabel: `${String(m).padStart(2, "0")}/${Y}`,
            baseValue: b,
            extrasTotal: ext,
            totalValue: b + ext,
          });
        }
        setOverview({
          currentBaseValue: getBaseValueForMonth(bv, 12, Y),
          totalPerUnit: (sumBase + sumExtras) / 12,
          monthExpensesTotal: sumExtras / 12,
          worksInProgress: ex.filter((e) => activeIds.has(e.id)),
          composition,
          billingHistory,
          selectedMonth: null,
          selectedYear: Y,
        });
        return;
      }

      if (reportMonth != null && reportYear == null) {
        const M = reportMonth;
        const years = yearOptions;
        const outs = await Promise.all(
          years.map((y) =>
            fetchCondominiumOverview({ month: M, year: y, historyMonths: 4, propertyId: selectedPropertyId }).catch(() => null)
          )
        );
        const valid = outs.map((o, i) => (o ? { o, y: years[i] } : null)).filter(Boolean);
        if (!valid.length) {
          setOverview(null);
          return;
        }
        const n = valid.length;
        let sumTotal = 0;
        let sumBase = 0;
        let sumExt = 0;
        const expenseSumByName = {};
        for (const { o } of valid) {
          sumTotal += o.totalPerUnit || 0;
          sumBase += o.currentBaseValue || 0;
          sumExt += o.monthExpensesTotal || 0;
          for (const c of o.composition || []) {
            if (c.label === "Condomínio base") continue;
            expenseSumByName[c.label] = (expenseSumByName[c.label] || 0) + (c.value || 0);
          }
        }
        const composition = [
          { label: `Condomínio base (média ${getMonthName(M)})`, value: sumBase / n },
        ];
        for (const [label, v] of Object.entries(expenseSumByName)) {
          composition.push({ label: `${label} (média)`, value: v / n });
        }
        const worksSet = new Set();
        valid.forEach(({ o }) =>
          (o.worksInProgress || []).forEach((w) => worksSet.add(w.id))
        );
        const billingHistory = valid.map(({ o, y }) => ({
          month: M,
          year: y,
          periodLabel: `${String(M).padStart(2, "0")}/${y}`,
          baseValue: o.currentBaseValue,
          extrasTotal: o.monthExpensesTotal,
          totalValue: o.totalPerUnit,
        }));
        setOverview({
          currentBaseValue: sumBase / n,
          totalPerUnit: sumTotal / n,
          monthExpensesTotal: sumExt / n,
          worksInProgress: ex.filter((e) => worksSet.has(e.id)),
          composition,
          billingHistory,
          selectedMonth: M,
          selectedYear: null,
        });
        return;
      }

      const o = await fetchCondominiumOverview({ month: cm, year: cy, historyMonths: 48, propertyId: selectedPropertyId });
      const bh = o.billingHistory || [];
      const last = bh.length ? bh[bh.length - 1] : null;
      setOverview({
        ...o,
        currentBaseValue: last?.baseValue ?? o.currentBaseValue,
        totalPerUnit: last?.totalValue ?? o.totalPerUnit,
        monthExpensesTotal: last?.extrasTotal ?? o.monthExpensesTotal,
        selectedMonth: null,
        selectedYear: null,
      });
    } catch (err) {
      console.error(err);
      setLoadError(err.message || "Erro ao carregar dados do condomínio.");
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [reportMonth, reportYear, yearOptions, selectedPropertyId]);

  useEffect(() => {
    if (propertiesLoaded && selectedPropertyId) loadAll();
  }, [loadAll, propertiesLoaded, selectedPropertyId]);

  const periodLabel = (() => {
    if (reportMonth == null && reportYear == null) return "Visão geral (últimos meses)";
    if (reportMonth == null) return `Todos os meses de ${reportYear}`;
    if (reportYear == null) return `${getMonthName(reportMonth)} (média entre anos)`;
    return `${getMonthName(reportMonth)} ${reportYear}`;
  })();

  const canNavigateMonth = reportMonth != null && reportYear != null;
  const isCurrentPeriod =
    reportMonth != null &&
    reportYear != null &&
    reportMonth === getCurrentMonthYear().month &&
    reportYear === getCurrentMonthYear().year;

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
    const { month, year } = getCurrentMonthYear();
    setReportMonth(month);
    setReportYear(year);
  };

  const periodSelectClass = "period-select-trigger h-10 w-full min-w-0";
  const compLabel =
    reportMonth == null && reportYear != null
      ? `${getMonthName(1)}–${getMonthName(12)} ${reportYear}`
      : periodLabel;

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  return (
    <div className="space-y-10 pb-12">
      {/* Seletor de Imóvel */}
      <section className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>Imóvel</span>
        </div>
        <Select
          value={selectedPropertyId || ""}
          onValueChange={(v) => setSelectedPropertyId(v)}
        >
          <SelectTrigger className="h-10 w-full sm:w-72">
            <SelectValue placeholder="Selecione um imóvel" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedProperty && (
          <span className="text-xs text-muted-foreground">
            {selectedProperty.unitCount} {selectedProperty.unitCount === 1 ? "unidade" : "unidades"}
          </span>
        )}
      </section>

      {!selectedPropertyId && propertiesLoaded && (
        <Card>
          <CardContent className="py-8 text-center">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {properties.length === 0
                ? "Nenhum imóvel cadastrado. Cadastre um imóvel primeiro para gerenciar o condomínio."
                : "Selecione um imóvel acima para visualizar e gerenciar seu condomínio."}
            </p>
          </CardContent>
        </Card>
      )}

      {selectedPropertyId && (
        <>
      <section className="period-hero-shell relative isolate overflow-hidden rounded-[2rem] border p-[1px] shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]"
          aria-hidden
        >
          <div className="absolute -left-20 top-[-10%] h-[24rem] w-[24rem] rounded-full bg-gradient-to-br from-white/50 via-white/15 to-transparent blur-3xl dark:from-white/12 dark:via-white/[0.04] dark:to-transparent" />
          <div className="absolute -right-16 top-[-15%] h-[18rem] w-[18rem] rounded-full bg-gradient-to-bl from-white/40 via-white/12 to-transparent blur-3xl dark:from-white/[0.08] dark:to-transparent" />
          <div className="absolute bottom-[-20%] left-1/4 h-64 w-64 rounded-full bg-gradient-to-t from-white/35 via-white/10 to-transparent blur-3xl dark:from-white/[0.05] dark:to-transparent" />
          <div className="absolute left-[6%] top-[16%] h-[5.5rem] w-[5.5rem] rounded-full border border-white/50 bg-white/20 backdrop-blur-2xl dark:border-white/15 dark:bg-white/[0.06]" />
          <div className="absolute right-[15%] top-[10%] h-16 w-16 rounded-full border border-white/45 bg-white/18 backdrop-blur-xl dark:border-white/12 dark:bg-white/[0.05]" />
        </div>

        <div className="period-hero-inner relative rounded-[1.95rem] border px-5 py-8 backdrop-blur-2xl sm:px-8 sm:py-10">
          <div className="period-hero-nav pointer-events-auto absolute right-4 top-4 z-20 flex gap-0.5 rounded-xl border p-1 shadow-sm backdrop-blur-md sm:right-6 sm:top-6">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={goPrev}
              disabled={!canNavigateMonth}
              className="h-9 w-9 shrink-0 rounded-lg text-foreground hover:bg-white/50 dark:hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
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
              className="h-9 w-9 shrink-0 rounded-lg text-foreground hover:bg-white/50 dark:hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-xl flex-1 space-y-3 lg:pr-4">
              <div className="period-hero-chip inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-foreground/40" />
                Período do condomínio
              </div>
              <h1 className="period-hero-title bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
                {periodLabel}
              </h1>
              <p className="period-hero-text text-sm leading-relaxed sm:text-base">
                Indicadores e composição abaixo seguem{" "}
                <span className="font-semibold text-foreground/90">{periodLabel}</span>. O gráfico de
                evolução mostra a série temporal do período escolhido (ou comparação entre anos, quando
                aplicável).
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
                    onValueChange={(v) =>
                      setReportMonth(v === "allMonths" ? null : parseInt(v, 10))
                    }
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
                    onValueChange={(v) =>
                      setReportYear(v === "allYears" ? null : parseInt(v, 10))
                    }
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
                variant="outline"
                onClick={goCurrent}
                disabled={isCurrentPeriod}
                className={cn(
                  "period-current-button h-10 w-full shrink-0 sm:w-auto hover:text-white",
                  isCurrentPeriod && "pointer-events-none opacity-45"
                )}
              >
                Mês atual
              </Button>
            </div>
          </div>
        </div>
      </section>

      {!loadError && (
        <section>
          <CondominiumSettingsCard onRefresh={loadAll} propertyId={selectedPropertyId} />
        </section>
      )}

      {loadError && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{loadError}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Verifique se as tabelas do módulo condomínio foram criadas
              (scripts/migrations/condominium-tables.sql).
            </p>
          </CardContent>
        </Card>
      )}

      {!loadError && (
        <>
          <section>
            <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
              Visão geral do condomínio
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">{periodLabel}</p>
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-[100px] animate-pulse rounded-xl border border-border bg-muted/20"
                  />
                ))}
              </div>
            ) : overview ? (
              <CondominiumDashboard
                currentBaseValue={overview.currentBaseValue}
                averagePerUnit={overview.totalPerUnit}
                monthExpensesTotal={overview.monthExpensesTotal}
                worksInProgressCount={overview.worksInProgress?.length ?? 0}
                totalCollection={0}
                formatCurrency={formatCurrency}
              />
            ) : null}
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
              Valor base do condomínio
            </h2>
            <CondominiumBaseValueManager
              baseValues={baseValues}
              onRefresh={loadAll}
              formatCurrency={formatCurrency}
              propertyId={selectedPropertyId}
            />
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
              Rateio de obras e despesas
            </h2>
            <ExpenseSplitManager
              expenses={expenses}
              onRefresh={loadAll}
              formatCurrency={formatCurrency}
              propertyId={selectedPropertyId}
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-1">
            <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
              Composição e evolução
            </h2>
            {overview && !loading && (
              <>
                <CondominiumComposition
                  composition={overview.composition ?? []}
                  totalPerUnit={overview.totalPerUnit ?? 0}
                  periodLabel={compLabel}
                  formatCurrency={formatCurrency}
                />
                <CondominiumEvolutionChart
                  billingHistory={overview.billingHistory ?? []}
                  formatCurrency={formatCurrency}
                />
              </>
            )}
          </section>
        </>
      )}
      </>
      )}
    </div>
  );
}
