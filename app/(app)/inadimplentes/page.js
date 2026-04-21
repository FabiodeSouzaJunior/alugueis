"use client";

import { Fragment, useEffect, useState, useMemo, useCallback } from "react";
import { usePageHeader } from "@/context/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, getMonthName, cn } from "@/lib/utils";
import { getCurrentMonthYear } from "@/lib/calculations";
import {
  fetchPayments,
  fetchTenantPaymentHistory,
  fetchTenants,
  updatePayment,
} from "@/lib/api";
import { getPaymentRowData } from "@/lib/calculations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContentWithClose,
} from "@/components/ui/dialog";
import { PaymentForm } from "@/components/forms/payment-form";
import { InadimplenciaStats } from "@/components/inadimplencia/InadimplenciaStats";
import { InadimplenciaStatusChart } from "@/components/inadimplencia/InadimplenciaStatusChart";
import { InadimplenciaTimeline } from "@/components/inadimplencia/InadimplenciaTimeline";
import { TopDebtorsList } from "@/components/inadimplencia/TopDebtorsList";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  MousePointerClick,
  BarChart3,
  TrendingDown,
  Users,
  Sparkles,
} from "lucide-react";
import { accentCardClasses } from "@/lib/chartColors";
import { PageViewTabs } from "@/components/layout/PageViewTabs";
import { InsightCard } from "@/components/ui/insight-card";

// —— Constantes de status (evita repetição e facilita manutenção)
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: getMonthName(i + 1),
}));

function shiftMonth(month, year, delta) {
  const d = new Date(year, month - 1 + delta, 1);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

function rowInPeriod(row, reportMonth, reportYear) {
  if (reportMonth != null && Number(row.month) !== Number(reportMonth)) return false;
  if (reportYear != null && Number(row.year) !== Number(reportYear)) return false;
  return true;
}

const STATUS_CONFIG = {
  pago: {
    label: "Pago",
    className:
      "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300 border-emerald-500/30",
    rowClassName: "bg-emerald-500/5 dark:bg-emerald-500/5",
  },
  pendente: {
    label: "Pendente",
    className:
      "bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300 border-amber-500/30",
    rowClassName: "bg-amber-500/10 dark:bg-amber-500/10",
  },
  atrasado: {
    label: "Atrasado",
    className:
      "bg-red-500/15 text-red-700 dark:bg-red-400/20 dark:text-red-300 border-red-500/30",
    rowClassName: "bg-red-500/10 dark:bg-red-500/10",
  },
};

/**
 * Monta uma linha de pagamento com dados calculados.
 * Inclui apenas pendentes e atrasados (exclui pago).
 * valorDevido = maior valor conhecido entre aluguel, esperado e pago.
 */
function buildPaymentRow(payment, tenant) {
  const candidates = [
    Number(tenant?.rentValue),
    Number(payment.expectedAmount),
    Number(payment.amount),
  ].filter((value) => Number.isFinite(value) && value > 0);
  const valorDevido = candidates.length ? Math.max(...candidates) : 0;
  const row = getPaymentRowData(payment, valorDevido);
  // Mostrar na tabela: pendente OU atrasado (não pago)
  if (row.status === "pago") return null;
  return {
    ...payment,
    tenantName: tenant?.name ?? "-",
    kitnetNumber: tenant?.kitnetNumber ?? "-",
    ...row,
  };
}

/** Ordena pagamentos: mais recente no topo (ano desc, mês desc). Usa número para mês (1–12). */
function sortPaymentsByYearMonthDesc(payments) {
  return [...payments].sort((a, b) => {
    const yearA = Number(a.year);
    const yearB = Number(b.year);
    const monthA = Number(a.month);
    const monthB = Number(b.month);
    if (yearA !== yearB) return yearB - yearA;
    if (monthA !== monthB) return monthB - monthA;
    return (b.dueDate || "").localeCompare(a.dueDate || "");
  });
}

/**
 * Agrupa por inquilino: nome aparece uma vez; ao expandir, mostra tabela com pendentes e atrasados.
 */
function buildGroupedByTenant(payments, tenants) {
  const byTenant = Object.fromEntries((tenants || []).map((t) => [t.id, t]));

  const rows = (payments || [])
    .map((p) => {
      const tenant = byTenant[p.tenantId];
      return buildPaymentRow(p, tenant);
    })
    .filter(Boolean)
    .sort((a, b) => {
      const yearA = Number(a.year);
      const yearB = Number(b.year);
      const monthA = Number(a.month);
      const monthB = Number(b.month);
      if (yearA !== yearB) return yearB - yearA;
      if (monthA !== monthB) return monthB - monthA;
      return (b.dueDate || "").localeCompare(a.dueDate || "");
    });

  const groups = {};
  rows.forEach((row) => {
    const id = row.tenantId;
    if (!groups[id]) {
      groups[id] = {
        tenantId: id,
        tenantName: row.tenantName,
        kitnetNumber: row.kitnetNumber,
        totalPendente: 0,
        payments: [],
      };
    }
    groups[id].totalPendente += row.pendente;
    groups[id].payments.push(row);
  });

  // Ordenar pagamentos dentro de cada grupo: mais recente no topo (ano desc, mês desc)
  Object.values(groups).forEach((g) => {
    g.payments = sortPaymentsByYearMonthDesc(g.payments);
  });

  return Object.values(groups).sort(
    (a, b) => b.totalPendente - a.totalPendente
  );
}

export default function InadimplentesPage() {
  const [grouped, setGrouped] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [tenantHistoryById, setTenantHistoryById] = useState({});
  const [loadingTenantHistoryId, setLoadingTenantHistoryId] = useState(null);
  const [activeView, setActiveView] = useState("tabela");
  const [reportMonth, setReportMonth] = useState(() => getCurrentMonthYear().month);
  const [reportYear, setReportYear] = useState(() => getCurrentMonthYear().year);

  const yearOptions = useMemo(() => {
    const cy = new Date().getFullYear();
    const years = new Set();
    grouped.forEach((g) =>
      (g.payments || []).forEach((p) => {
        const y = Number(p.year);
        if (!isNaN(y) && y > 1990) years.add(y);
      })
    );
    let min = years.size ? Math.min(...years) : cy - 2;
    let max = years.size ? Math.max(...years) : cy + 1;
    min = Math.min(min, cy - 6);
    max = Math.max(max, cy + 1);
    const out = [];
    for (let y = min; y <= max; y++) out.push(y);
    return out;
  }, [grouped]);

  const load = async () => {
    setLoadError(null);
    try {
      setLoading(true);
      const [paymentsData, tenantsData] = await Promise.all([
        fetchPayments({ openOnly: true }),
        fetchTenants({ financialOnly: true }),
      ]);
      const payments = Array.isArray(paymentsData) ? paymentsData : [];
      const tenantsList = Array.isArray(tenantsData) ? tenantsData : [];
      setTenants(tenantsList);
      setGrouped(buildGroupedByTenant(payments, tenantsList));
    } catch (e) {
      console.error(e);
      setGrouped([]);
      setTenantHistoryById({});
      setLoadError(e?.message || "Erro ao carregar. Verifique o servidor e o banco.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const ensureTenantHistory = useCallback(async (tenantId) => {
    if (!tenantId) return [];
    if (tenantHistoryById[tenantId]) return tenantHistoryById[tenantId];

    setLoadingTenantHistoryId(tenantId);
    try {
      const history = await fetchTenantPaymentHistory(tenantId, { openOnly: true });
      const list = Array.isArray(history) ? history : [];
      setTenantHistoryById((prev) => ({ ...prev, [tenantId]: list }));
      return list;
    } catch (error) {
      console.error(error);
      return [];
    } finally {
      setLoadingTenantHistoryId((current) => (current === tenantId ? null : current));
    }
  }, [tenantHistoryById]);

  const handleSavePayment = async (payload) => {
    if (!editingPayment?.id) return;
    setSaveError(null);
    setSaving(true);
    try {
      const pay = {
        ...payload,
        amount: Number(payload.amount) ?? 0,
      };
      await updatePayment(editingPayment.id, pay);
      setDialogOpen(false);
      setEditingPayment(null);
      setTenantHistoryById((prev) => {
        const tenantId = editingPayment?.tenantId;
        if (!tenantId) return prev;
        const next = { ...prev };
        delete next[tenantId];
        return next;
      });
      await load();
    } catch (e) {
      console.error(e);
      setSaveError(e?.message ?? "Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const { setPageHeader } = usePageHeader();
  useEffect(() => {
    setPageHeader({
      title: "Inadimplentes",
      description: "Pagamentos pendentes e em atraso.",
      action: null,
    });
    return () => setPageHeader({ title: null, description: null, action: null });
  }, [setPageHeader]);

  // KPIs / pizza / tops seguem o período; linha do tempo permanece global (evolução).
  const dashboardData = useMemo(() => {
    const allRowsGlobal = grouped.flatMap((g) => g.payments || []);
    const rowsPeriod = allRowsGlobal.filter((r) =>
      rowInPeriod(r, reportMonth, reportYear)
    );

    const byTenantPeriod = {};
    rowsPeriod.forEach((r) => {
      const id = r.tenantId;
      if (!byTenantPeriod[id]) {
        byTenantPeriod[id] = {
          tenantId: id,
          tenantName: r.tenantName,
          kitnetNumber: r.kitnetNumber,
          totalPendente: 0,
          payments: [],
        };
      }
      byTenantPeriod[id].totalPendente += r.pendente || 0;
      byTenantPeriod[id].payments.push(r);
    });
    const groupsPeriod = Object.values(byTenantPeriod);
    const totalInadimplentes = groupsPeriod.length;
    const valorTotalDebito = groupsPeriod.reduce((s, g) => s + (g.totalPendente || 0), 0);

    const atrasados = rowsPeriod.filter((r) => r.status === "atrasado");
    const pendentesOnly = rowsPeriod.filter((r) => r.status === "pendente");
    const totalAtrasado = atrasados.reduce((s, r) => s + (r.pendente || 0), 0);
    const totalPendente = pendentesOnly.reduce((s, r) => s + (r.pendente || 0), 0);

    const statusChartData = [
      { name: "Pendente", value: totalPendente },
      { name: "Atrasado", value: totalAtrasado },
    ].filter((d) => d.value > 0);

    const byPeriod = {};
    allRowsGlobal.forEach((r) => {
      const y = r.year;
      const m = r.month;
      if (y != null && m != null) {
        const key = `${y}-${String(m).padStart(2, "0")}`;
        byPeriod[key] = (byPeriod[key] || 0) + (r.pendente || 0);
      }
    });
    const timelineData = Object.entries(byPeriod).map(([periodKey, value]) => {
      const [y, m] = periodKey.split("-").map(Number);
      const shortMonth = (getMonthName(m) || "").slice(0, 3);
      return { periodKey, label: `${shortMonth}/${String(y).slice(2)}`, value };
    });

    const top5 = [...groupsPeriod]
      .sort((a, b) => b.totalPendente - a.totalPendente)
      .slice(0, 5);
    const top5ByParcelas = [...groupsPeriod]
      .sort((a, b) => (b.payments?.length || 0) - (a.payments?.length || 0))
      .slice(0, 5)
      .map((g) => ({ ...g, parcelasEmAberto: g.payments?.length || 0 }));

    return {
      totalInadimplentes,
      valorTotalDebito,
      totalAtrasado,
      totalPendente,
      countAtrasados: atrasados.length,
      countPendentes: pendentesOnly.length,
      statusChartData,
      timelineData,
      top5,
      top5ByParcelas,
    };
  }, [grouped, reportMonth, reportYear]);

  const periodLabel = (() => {
    if (reportMonth == null && reportYear == null) return "Todos os períodos";
    if (reportMonth == null) return `Todos os meses ${reportYear}`;
    if (reportYear == null) return `${getMonthName(reportMonth)} (todos os anos)`;
    return `${getMonthName(reportMonth)} ${reportYear}`;
  })();

  const canNavigateMonth = reportMonth != null && reportYear != null;
  const isCurrentPeriod =
    reportMonth != null &&
    reportYear != null &&
    reportMonth === getCurrentMonthYear().month &&
    reportYear === getCurrentMonthYear().year;

  const goPrev = useCallback(() => {
    if (!canNavigateMonth) return;
    const n = shiftMonth(reportMonth, reportYear, -1);
    setReportMonth(n.month);
    setReportYear(n.year);
  }, [canNavigateMonth, reportMonth, reportYear]);
  const goNext = useCallback(() => {
    if (!canNavigateMonth) return;
    const n = shiftMonth(reportMonth, reportYear, 1);
    setReportMonth(n.month);
    setReportYear(n.year);
  }, [canNavigateMonth, reportMonth, reportYear]);
  const goCurrent = useCallback(() => {
    const { month, year } = getCurrentMonthYear();
    setReportMonth(month);
    setReportYear(year);
  }, []);

  const periodSelectClass = "period-select-trigger h-10 w-full min-w-0";

  return (
    <div className="space-y-6">
      {activeView !== "tabela" && (
      <section className="period-hero-shell relative isolate overflow-hidden rounded-[2rem] border p-[1px] shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]"
          aria-hidden
        >
          <div className="absolute -left-20 top-[-10%] h-[24rem] w-[24rem] rounded-full bg-gradient-to-br from-white/50 via-white/15 to-transparent blur-3xl dark:from-white/12 dark:via-white/[0.04] dark:to-transparent" />
          <div className="absolute -right-16 top-[-15%] h-[18rem] w-[18rem] rounded-full bg-gradient-to-bl from-white/40 via-white/12 to-transparent blur-3xl dark:from-white/[0.08] dark:to-transparent" />
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
                Período do dashboard
              </div>
              <h2 className="period-hero-title bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
                {periodLabel}
              </h2>
              <p className="period-hero-text text-sm">
                KPIs, pizza e rankings usam este período. A linha do tempo de evolução continua
                mostrando todos os meses.
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
      )}

      <PageViewTabs
        value={activeView}
        onValueChange={setActiveView}
        tabelaContent={
      <Card className="rounded-xl border border-border/80 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            Pagamentos pendentes e atrasados
          </CardTitle>
          <CardDescription>
            Veja abaixo os inquilinos com valores em aberto.
          </CardDescription>
          <div className="mt-3 flex flex-col items-start gap-2 rounded-lg border-2 border-amber-500/40 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
            <MousePointerClick className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Clique na linha do inquilino para ver todos os pagamentos atrasados e pendentes.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {!loading && loadError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <p className="text-center text-muted-foreground">{loadError}</p>
              <Button variant="outline" onClick={() => load()}>
                Tentar novamente
              </Button>
            </div>
          ) : loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Carregando...
            </p>
          ) : (
            <Table mobileCards>
              <TableHeader>
                <TableRow className="border-0 bg-muted/40 hover:bg-muted/40">
                  <TableHead className="h-11 w-10 px-4 py-3" aria-label="Expandir" />
                  <TableHead className="h-11 px-4 py-3 text-left font-semibold text-foreground">
                    Nome
                  </TableHead>
                  <TableHead className="h-11 px-4 py-3 text-left font-semibold text-foreground">
                    Kitnet
                  </TableHead>
                  <TableHead className="h-11 px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                    Valor total em débito
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.length === 0 ? (
                  <TableRow data-mobile-detail="true">
                    <TableCell
                      data-mobile-full="true"
                      colSpan={4}
                      className="h-24 px-4 py-3 text-center text-sm text-muted-foreground"
                    >
                      Nenhum pagamento pendente ou atrasado.
                    </TableCell>
                  </TableRow>
                ) : (
                  grouped.map((g) => (
                    <Fragment key={g.tenantId}>
                      {(() => {
                        const isExpanded = expandedId === g.tenantId;
                        const expandedPayments = isExpanded
                          ? sortPaymentsByYearMonthDesc(
                              (g.payments || [])
                                .map((payment) =>
                                  payment.valorDevido != null
                                    ? payment
                                    : buildPaymentRow(
                                        payment,
                                        tenants.find((tenant) => tenant.id === g.tenantId)
                                      )
                                )
                                .filter(Boolean)
                            )
                          : [];

                        return (
                          <>
                      <TableRow
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/50",
                          expandedId === g.tenantId && "bg-muted/30"
                        )}
                        onClick={() => {
                          setExpandedId(expandedId === g.tenantId ? null : g.tenantId);
                        }}
                      >
                        <TableCell data-mobile-full="true" className="w-10 px-4 py-3 align-middle">
                          {expandedId === g.tenantId ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell data-mobile-primary="true" className="px-4 py-3 text-left align-middle text-sm font-medium">
                          {g.tenantName}
                        </TableCell>
                        <TableCell data-label="Kitnet" className="px-4 py-3 text-left align-middle text-sm text-muted-foreground">
                          {g.kitnetNumber}
                        </TableCell>
                        <TableCell data-label="Debito total" className="px-4 py-3 text-right align-middle text-sm tabular-nums font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(g.totalPendente)}
                        </TableCell>
                      </TableRow>
                      {expandedId === g.tenantId && (
                        <TableRow data-mobile-detail="true" className="hover:bg-transparent">
                          <TableCell
                            data-mobile-full="true"
                            colSpan={4}
                            className="border-t-0 bg-muted/10 p-0 align-top"
                          >
                            <div className="px-4 py-4">
                              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Todos os pagamentos atrasados e pendentes
                              </p>
                              <div className="overflow-x-auto rounded-lg border border-border/50">
                              <table className="w-full min-w-[800px] table-fixed caption-bottom text-sm border-collapse">
                                <thead>
                                  <tr className="bg-muted/40">
                                    <th className="h-10 w-[14%] px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Mês/Ano</th>
                                    <th className="h-10 w-[16%] px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Valor devido</th>
                                    <th className="h-10 w-[14%] px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Valor pago</th>
                                    <th className="h-10 w-[14%] px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Pendente</th>
                                    <th className="h-10 w-[14%] px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Dias atraso</th>
                                    <th className="h-10 w-[18%] px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Status</th>
                                    <th className="h-10 w-[10%] px-3 py-2 text-center text-xs font-medium text-muted-foreground whitespace-nowrap">Ações</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {expandedPayments.map((row) => {
                                    const config =
                                      STATUS_CONFIG[row.status] ?? STATUS_CONFIG.pendente;
                                    return (
                                      <tr
                                        key={row.id}
                                        className={cn(
                                          "border-b border-border/30 last:border-0 transition-colors hover:bg-muted/20",
                                          config.rowClassName
                                        )}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <td className="px-3 py-2.5 align-middle text-sm">
                                          {getMonthName(row.month)}/{row.year}
                                        </td>
                                        <td className="px-3 py-2.5 align-middle text-sm text-muted-foreground">
                                          {formatCurrency(row.valorDevido)}
                                        </td>
                                        <td className="px-3 py-2.5 align-middle text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                          {formatCurrency(row.valorPago)}
                                        </td>
                                        <td className="px-3 py-2.5 align-middle text-sm font-semibold text-red-600 dark:text-red-400">
                                          {formatCurrency(row.pendente)}
                                        </td>
                                        <td className="px-3 py-2.5 align-middle text-sm">
                                          {row.diasAtraso != null ? (
                                            <span className="font-medium text-red-600 dark:text-red-400">
                                              {row.diasAtraso}
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground">–</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2.5 align-middle">
                                          <Badge
                                            variant="outline"
                                            className={cn("font-medium", config.className)}
                                          >
                                            {config.label}
                                          </Badge>
                                        </td>
                                        <td className="px-3 py-2.5 text-center align-middle">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingPayment(row);
                                              setDialogOpen(true);
                                            }}
                                            title="Editar pagamento"
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                          </>
                        );
                      })()}
                    </Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        }
        dashboardContent={!loading && !loadError ? (
        <section className="space-y-8 pt-4">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Análise de Inadimplência
          </h2>
          <p className="text-sm text-muted-foreground">Período: {periodLabel}</p>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              KPIs principais
            </h3>
            <InadimplenciaStats
              totalInadimplentes={dashboardData.totalInadimplentes}
              valorTotalDebito={dashboardData.valorTotalDebito}
              totalAtrasado={dashboardData.totalAtrasado}
              totalPendente={dashboardData.totalPendente}
              countAtrasados={dashboardData.countAtrasados}
              countPendentes={dashboardData.countPendentes}
              formatCurrency={formatCurrency}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
              <CardHeader className={cn("border-b border-border/50 pb-2", accentCardClasses.warning)}>
                <CardTitle className="text-base font-semibold">Distribuição por status</CardTitle>
                <CardDescription>
                  Pendente (no prazo) vs Atrasado (vencido)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InadimplenciaStatusChart
                  data={dashboardData.statusChartData}
                  formatCurrency={formatCurrency}
                />
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
              <CardHeader className={cn("border-b border-border/50 pb-2", accentCardClasses.expense)}>
                <CardTitle className="text-base font-semibold">Evolução da inadimplência</CardTitle>
                <CardDescription>
                  Valor pendente por mês/ano
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InadimplenciaTimeline
                  data={dashboardData.timelineData}
                  formatCurrency={formatCurrency}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
            <Card className="overflow-hidden rounded-xl border border-border shadow-sm flex flex-col">
              <CardHeader className={cn("border-b border-border/50 pb-2", accentCardClasses.warning)}>
                <CardTitle className="text-base font-semibold">Top 5 pessoas que mais ficam em débito</CardTitle>
                <CardDescription>
                  Inquilinos com mais parcelas em aberto
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pt-6">
                <TopDebtorsList
                  items={dashboardData.top5ByParcelas}
                  formatCurrency={formatCurrency}
                  metric="installments"
                />
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-xl border border-border shadow-sm flex flex-col">
              <CardHeader className={cn("border-b border-border/50 pb-2", accentCardClasses.expense)}>
                <CardTitle className="text-base font-semibold">Top 5 maiores débitos</CardTitle>
                <CardDescription>
                  Inquilinos com maior valor em aberto
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pt-6">
                <TopDebtorsList
                  items={dashboardData.top5}
                  formatCurrency={formatCurrency}
                />
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}
        insightsContent={!loading && !loadError ? (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Insights
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <InsightCard icon={Users} title="Inadimplência" accent="expense">
              {dashboardData.totalInadimplentes === 0 ? (
                <>Nenhum inadimplente no momento. Todos os pagamentos estão em dia.</>
              ) : (
                <>
                  <strong>{dashboardData.totalInadimplentes}</strong> inquilino(s) com valor em débito.
                  Valor total em aberto: <strong>{formatCurrency(dashboardData.valorTotalDebito)}</strong>.
                </>
              )}
            </InsightCard>
            <InsightCard icon={BarChart3} title="Por status" accent="warning">
              Valor atrasado: <strong>{formatCurrency(dashboardData.totalAtrasado)}</strong>.
              Valor pendente (no prazo): <strong>{formatCurrency(dashboardData.totalPendente)}</strong>.
            </InsightCard>
            <InsightCard icon={TrendingDown} title="Análise" accent="expense">
              {dashboardData.totalInadimplentes > 0 && (
                <>Os maiores débitos e as pessoas que mais ficam em débito estão listados no dashboard.</>
              )}
            </InsightCard>
          </div>
        </section>
      ) : null}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingPayment(null);
          setSaveError(null);
        }}
      >
        <DialogContentWithClose
          title="Editar pagamento"
          onClose={() => {
            setDialogOpen(false);
            setEditingPayment(null);
            setSaveError(null);
          }}
        >
          {saveError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {saveError}
            </p>
          )}
          {editingPayment && (
            <PaymentForm
              payment={editingPayment}
              tenants={tenants}
              onSave={handleSavePayment}
              onCancel={() => {
                setDialogOpen(false);
                setEditingPayment(null);
                setSaveError(null);
              }}
              saving={saving}
            />
          )}
        </DialogContentWithClose>
      </Dialog>
    </div>
  );
}
