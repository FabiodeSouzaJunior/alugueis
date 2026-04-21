"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { usePageHeader } from "@/context/page-header";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, getMonthName, cn } from "@/lib/utils";
import {
  getCurrentMonthYear,
  getPaymentsForMonth,
  getExpensesForMonth,
  getPaymentRowData,
} from "@/lib/calculations";
import { fetchTenants, fetchPayments, fetchExpenses } from "@/lib/api";
import { StatsCard } from "@/components/reports/StatsCard";
import { FinanceMetricCard } from "@/components/reports/FinanceMetricCard";
import { RevenueVsExpensesChart, PaymentDistributionChart } from "@/components/reports/ReportsChart";
import { FinanceSummary } from "@/components/reports/FinanceSummary";
import { ChartCard } from "@/components/cards/ChartCard";
import {
  TrendingUp,
  TrendingDown,
  Banknote,
  AlertCircle,
  Clock,
  DollarSign,
  PiggyBank,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: getMonthName(i + 1),
}));

function enrichPaymentsForMonth(payments, tenants) {
  const tenantById = Object.fromEntries((tenants || []).map((tenant) => [tenant.id, tenant]));

  return (payments || []).map((p) => {
    const tenantRent = Number(tenantById[p.tenantId]?.rentValue);
    const expectedAmount = Number(p.expectedAmount);
    const paidAmount = Number(p.amount);
    const candidates = [tenantRent, expectedAmount, paidAmount].filter(
      (value) => Number.isFinite(value) && value > 0
    );
    const valorDevido = candidates.length ? Math.max(...candidates) : 0;
    const row = getPaymentRowData(p, valorDevido);

    return {
      ...p,
      expectedAmount: row.valorDevido,
      valorDevido: row.valorDevido,
      valorPago: row.valorPago,
      pendente: row.pendente,
      status: row.status,
      diasAtraso: row.diasAtraso,
    };
  });
}

function shiftMonth(month, year, delta) {
  const d = new Date(year, month - 1 + delta, 1);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

function buildYearRange(payments, expenses) {
  const cy = new Date().getFullYear();
  let min = cy;
  let max = cy;
  (payments || []).forEach((p) => {
    const y = Number(p.year);
    if (!isNaN(y) && y > 1990) {
      min = Math.min(min, y);
      max = Math.max(max, y);
    }
  });
  (expenses || []).forEach((e) => {
    if (!e?.date) return;
    const y = new Date(e.date).getFullYear();
    if (!isNaN(y)) {
      min = Math.min(min, y);
      max = Math.max(max, y);
    }
  });
  min = Math.min(min, cy - 6);
  max = Math.max(max, cy + 1);
  const out = [];
  for (let y = min; y <= max; y++) out.push(y);
  return out;
}

export default function RelatoriosPage() {
  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const { month: initialMonth, year: initialYear } = useMemo(() => getCurrentMonthYear(), []);
  const [reportMonth, setReportMonth] = useState(initialMonth);
  const [reportYear, setReportYear] = useState(initialYear);

  const loadData = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const [tRes, pRes, eRes] = await Promise.all([
        fetchTenants(),
        fetchPayments(),
        fetchExpenses(),
      ]);
      setTenants(Array.isArray(tRes) ? tRes : []);
      setPayments(Array.isArray(pRes) ? pRes : []);
      setExpenses(Array.isArray(eRes) ? eRes : []);
    } catch (err) {
      console.error(err);
      setLoadError(
        err?.message || "Erro ao carregar. Verifique se o servidor e o banco estão ativos."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const paymentsEnriched = useMemo(
    () => enrichPaymentsForMonth(payments, tenants),
    [payments, tenants]
  );

  const yearOptions = useMemo(
    () => buildYearRange(payments, expenses),
    [payments, expenses]
  );

  const periodPayments = useMemo(() => {
    let list = Array.isArray(paymentsEnriched) ? paymentsEnriched : [];
    if (reportMonth != null) {
      list = list.filter((p) => Number(p.month) === Number(reportMonth));
    }
    if (reportYear != null) {
      list = list.filter((p) => Number(p.year) === Number(reportYear));
    }
    return list;
  }, [paymentsEnriched, reportMonth, reportYear]);

  const periodExpenses = useMemo(() => {
    let list = Array.isArray(expenses) ? expenses : [];
    if (reportMonth != null) {
      list = list.filter((e) => {
        if (!e?.date) return false;
        const d = new Date(e.date);
        return d.getMonth() + 1 === Number(reportMonth);
      });
    }
    if (reportYear != null) {
      list = list.filter((e) => {
        if (!e?.date) return false;
        const d = new Date(e.date);
        return d.getFullYear() === Number(reportYear);
      });
    }
    return list;
  }, [expenses, reportMonth, reportYear]);

  const stats = useMemo(() => {
    const activeTenants = (tenants || []).filter((t) => t.status === "ativo");
    const totalKitnets = 12;
    const occupied = activeTenants.length;
    const empty = Math.max(0, totalKitnets - occupied);

    const expectedRevenue = periodPayments.reduce(
      (s, p) => s + (Number(p.valorDevido ?? p.expectedAmount) || 0), 0
    );

    const receivedRevenue = periodPayments.reduce(
      (s, p) => s + (Number(p.valorPago ?? p.amount) || 0), 0
    );

    const monthExpensesTotal = periodExpenses.reduce(
      (s, e) => s + (Number(e.value) || 0), 0
    );

    const profit = receivedRevenue - monthExpensesTotal;

    return {
      totalKitnets,
      occupied,
      empty,
      expectedRevenue,
      receivedRevenue,
      profit,
      monthExpensesTotal,
    };
  }, [periodPayments, periodExpenses, tenants]);

  const monthDetail = useMemo(() => {
    const monthPayments = periodPayments;
    const totalExpected = monthPayments.reduce(
      (s, p) => s + (Number(p.valorDevido ?? p.expectedAmount) || 0), 0
    );

    const totalReceived = monthPayments.reduce(
      (s, p) => s + (Number(p.valorPago ?? p.amount) || 0), 0
    );

    const totalOverdue = monthPayments
      .filter((p) => p.status === "atrasado")
      .reduce((s, p) => s + (Number(p.pendente) || 0), 0);

    const totalPending = monthPayments
      .filter((p) => p.status === "pendente")
      .reduce((s, p) => s + (Number(p.pendente) || 0), 0);

    return {
      month: reportMonth,
      year: reportYear,
      totalExpected,
      totalReceived,
      totalPending,
      totalOverdue,
    };
  }, [periodPayments, reportMonth, reportYear]);

  const trends = useMemo(() => {
    if (reportMonth == null || reportYear == null) {
      return { receivedTrend: null, expensesTrend: null, profitTrend: null };
    }
    const prev = shiftMonth(reportMonth, reportYear, -1);
    const prevPayments = getPaymentsForMonth(paymentsEnriched, prev.month, prev.year);
    const prevReceived = prevPayments.reduce(
      (s, x) => s + (Number(x.valorPago ?? x.amount) || 0), 0
    );
    const prevExpensesTotal = getExpensesForMonth(expenses, prev.month, prev.year).reduce(
      (s, x) => s + Number(x.value || 0), 0
    );
    const prevProfit = prevReceived - prevExpensesTotal;
    const currentReceived = monthDetail.totalReceived;
    const currentExpensesTotal = getExpensesForMonth(expenses, reportMonth, reportYear).reduce(
      (s, x) => s + Number(x.value || 0), 0
    );
    const currentProfit = currentReceived - currentExpensesTotal;

    const receivedTrend =
      prevReceived > 0
        ? Math.round(((currentReceived - prevReceived) / prevReceived) * 100)
        : null;
    const expensesTrend =
      prevExpensesTotal > 0
        ? Math.round(((currentExpensesTotal - prevExpensesTotal) / prevExpensesTotal) * 100)
        : null;
    const profitTrend =
      prevProfit !== 0
        ? Math.round(((currentProfit - prevProfit) / Math.abs(prevProfit)) * 100)
        : null;

    return { receivedTrend, expensesTrend, profitTrend };
  }, [paymentsEnriched, expenses, reportMonth, reportYear, monthDetail.totalReceived]);

  /** Gráficos seguem o mesmo mês/ano selecionado nos indicadores. */
  const chartBarData = useMemo(
    () => {
      const name =
        reportMonth == null && reportYear == null
          ? "Total"
          : reportMonth == null
            ? String(reportYear)
            : getMonthName(reportMonth).slice(0, 3);

      return [
        {
          name,
          Receita: stats.receivedRevenue,
          Despesas: stats.monthExpensesTotal,
        },
      ];
    },
    [reportMonth, reportYear, stats.receivedRevenue, stats.monthExpensesTotal]
  );

  const chartPieData = useMemo(
    () =>
      [
        { name: "Recebido", value: monthDetail.totalReceived },
        { name: "Pendente", value: monthDetail.totalPending },
        { name: "Atrasado", value: monthDetail.totalOverdue },
      ].filter((d) => d.value > 0),
    [
      monthDetail.totalReceived,
      monthDetail.totalPending,
      monthDetail.totalOverdue,
    ]
  );

  const { setPageHeader } = usePageHeader();
  useEffect(() => {
    setPageHeader({
      title: "Relatórios",
      description: "Análise financeira por período",
      action: null,
    });
    return () => setPageHeader({ title: null, description: null, action: null });
  }, [setPageHeader]);

  const goPrev = () => {
    if (reportMonth == null || reportYear == null) return;
    const n = shiftMonth(reportMonth, reportYear, -1);
    setReportMonth(n.month);
    setReportYear(n.year);
  };
  const goNext = () => {
    if (reportMonth == null || reportYear == null) return;
    const n = shiftMonth(reportMonth, reportYear, 1);
    setReportMonth(n.month);
    setReportYear(n.year);
  };
  const goCurrent = () => {
    const { month, year } = getCurrentMonthYear();
    setReportMonth(month);
    setReportYear(year);
  };

  if (loadError && !loading && tenants.length === 0 && payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <p className="text-center text-muted-foreground">{loadError}</p>
        <Button variant="outline" onClick={() => loadData()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (loading && payments.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Carregando relatórios…</p>
      </div>
    );
  }

  const periodLabel = (() => {
    if (reportMonth == null && reportYear == null) return "Todos os períodos";
    if (reportMonth == null) return `Todos os meses ${reportYear}`;
    if (reportYear == null) return `${getMonthName(reportMonth)} (todos os anos)`;
    return `${getMonthName(reportMonth)} ${reportYear}`;
  })();

  const isCurrentPeriod =
    reportMonth != null &&
    reportYear != null &&
    reportMonth === getCurrentMonthYear().month &&
    reportYear === getCurrentMonthYear().year;

  const canNavigateMonth = reportMonth != null && reportYear != null;

  /** Mesmo trigger padrão do sistema para Mês e Ano (alinhados). */
  const periodSelectClass = "period-select-trigger h-10 w-full min-w-0";

  return (
    <div className="space-y-10 pb-12">
      {/* Seletor de período — glass mais transparente */}
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
          <div className="absolute bottom-[18%] right-[6%] h-32 w-32 rounded-full border border-white/40 bg-gradient-to-br from-white/25 to-transparent backdrop-blur-2xl dark:border-white/12 dark:from-white/[0.06]" />
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
                Relatório mensal
              </div>
              <h1 className="period-hero-title bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
                {periodLabel}
              </h1>
              <p className="period-hero-text text-sm leading-relaxed sm:text-base">
                Receitas, despesas e pagamentos abaixo refletem exclusivamente{" "}
                <span className="font-semibold text-foreground/90">{periodLabel}</span>.
                Use os controles para navegar entre meses e anos.
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

      {/* KPIs */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 border-b border-border/60 pb-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Indicadores do período</h2>
            <p className="text-sm text-muted-foreground">{periodLabel}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            title="Receita esperada"
            value={formatCurrency(stats.expectedRevenue)}
            description="Soma dos aluguéis previstos no período"
            icon={DollarSign}
            trend={trends?.receivedTrend}
            trendLabel="vs mês anterior"
          />
          <StatsCard
            title="Receita recebida"
            value={formatCurrency(stats.receivedRevenue)}
            description="Valores creditados no período"
            icon={TrendingUp}
            variant="positive"
            trend={trends?.receivedTrend}
            trendLabel="vs mês anterior"
          />
          <StatsCard
            title="Despesas"
            value={formatCurrency(stats.monthExpensesTotal)}
            description="Saídas registradas no período"
            icon={TrendingDown}
            variant="negative"
            trend={trends?.expensesTrend}
            trendLabel="vs mês anterior"
          />
          <StatsCard
            title="Lucro"
            value={formatCurrency(stats.profit)}
            description="Recebido − despesas"
            icon={PiggyBank}
            variant={stats.profit >= 0 ? "positive" : "negative"}
            trend={trends?.profitTrend}
            trendLabel="vs mês anterior"
          />
        </div>
      </section>

      {/* Pagamentos */}
      <section className="space-y-4">
        <h2 className="border-b border-border/60 pb-3 text-lg font-semibold tracking-tight">
          Pagamentos no período
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <FinanceMetricCard
            title="Total recebido"
            value={formatCurrency(monthDetail.totalReceived)}
            icon={Banknote}
            variant="received"
          />
          <FinanceMetricCard
            title="Total pendente"
            value={formatCurrency(monthDetail.totalPending)}
            icon={Clock}
            variant="pending"
          />
          <FinanceMetricCard
            title="Total atrasado"
            value={formatCurrency(monthDetail.totalOverdue)}
            icon={AlertCircle}
            variant="overdue"
          />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Receita vs Despesas"
          description={`${periodLabel} — comparação`}
          accent="revenue"
          contentClassName="pt-0"
        >
          {chartBarData.length > 0 &&
          (stats.receivedRevenue > 0 || stats.monthExpensesTotal > 0) ? (
            <RevenueVsExpensesChart
              key={`bar-${reportMonth}-${reportYear}`}
              data={chartBarData}
            />
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              Sem dados para exibir
            </div>
          )}
        </ChartCard>
        <ChartCard
          title="Distribuição de pagamentos"
          description={`Recebido, pendente e atrasado — ${periodLabel}`}
          accent="revenue"
          contentClassName="pt-0"
        >
          {chartPieData.length > 0 ? (
            <PaymentDistributionChart
              key={`pie-${reportMonth}-${reportYear}`}
              data={chartPieData}
            />
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              Nenhum pagamento no período
            </div>
          )}
        </ChartCard>
      </section>

      {/* Lucro */}
      <section className="space-y-4">
        <h2 className="border-b border-border/60 pb-3 text-lg font-semibold tracking-tight">
          Fechamento do lucro
        </h2>
        <FinanceSummary
          receivedLabel="Receita recebida"
          receivedValue={formatCurrency(stats.receivedRevenue)}
          expensesLabel={canNavigateMonth ? "Despesas do mês" : "Despesas do período"}
          expensesValue={formatCurrency(stats.monthExpensesTotal)}
          resultLabel="Lucro"
          resultValue={formatCurrency(stats.profit)}
        />
      </section>
    </div>
  );
}
