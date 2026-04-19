"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { usePageHeader } from "@/context/page-header";
import Link from "next/link";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContentWithClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate, getMonthName } from "@/lib/utils";
import { getCurrentMonthYear } from "@/lib/calculations";
import { fetchObras, fetchObrasDashboard, createObra, updateObra, deleteObra, fetchProperties } from "@/lib/api";
import { Plus, Pencil, Trash2, ArrowRight, HardHat, DollarSign, Target, Wallet, Ruler, BarChart3, PieChart, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { accentCardClasses } from "@/lib/chartColors";
import { PageViewTabs } from "@/components/layout/PageViewTabs";
import { InsightCard } from "@/components/ui/insight-card";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ObraStatsCard } from "@/components/obra-reports/ObraStatsCard";
import { ObraFinancialProgress } from "@/components/obra-reports/ObraFinancialProgress";
import { ObraCostsByCategoryChart, ObraCostsEvolutionChart } from "@/components/obra-reports/ObraCostsChart";
import { ObraCostsAccordion } from "@/components/obra-reports/ObraCostsAccordion";
import { ObraResumoGeral } from "@/components/obra-reports/ObraResumoGeral";
import { ObraCustoPorTrabalhador } from "@/components/obra-reports/ObraCustoPorTrabalhador";

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

export default function ObrasPage() {
  const [obras, setObras] = useState([]);
  const [properties, setProperties] = useState([]);
  const [dashboardData, setDashboardData] = useState({ obras: [], costs: [], workers: [] });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingObra, setEditingObra] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [activeView, setActiveView] = useState("tabela");

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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [listData, dashData, propsData] = await Promise.all([
        fetchObras(),
        fetchObrasDashboard().catch(() => ({ obras: [], costs: [], workers: [] })),
        fetchProperties().catch(() => []),
      ]);
      setObras(Array.isArray(listData) ? listData : []);
      setDashboardData({
        obras: Array.isArray(dashData?.obras) ? dashData.obras : [],
        costs: Array.isArray(dashData?.costs) ? dashData.costs : [],
        workers: Array.isArray(dashData?.workers) ? dashData.workers : [],
      });
      setProperties(Array.isArray(propsData) ? propsData : []);
    } catch (e) {
      console.error(e);
      setObras([]);
      setDashboardData({ obras: [], costs: [], workers: [] });
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback(
    async (payload) => {
      setSaveError(null);
      setSaving(true);
      try {
        if (editingObra) {
          await updateObra(editingObra.id, payload);
        } else {
          await createObra(payload);
        }
        setDialogOpen(false);
        setEditingObra(null);
        await load();
      } catch (e) {
        console.error(e);
        setSaveError(e?.message || "Erro ao salvar. Tente novamente.");
      } finally {
        setSaving(false);
      }
    },
    [editingObra, load]
  );

  const handleDeleteClick = useCallback((obra) => setDeleteConfirm(obra), []);
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteObra(deleteConfirm.id);
      setDeleteConfirm(null);
      await load();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Erro ao excluir.");
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirm, load]);

  const { obras: dashObras, costs, workers } = dashboardData;
  const propertyById = useMemo(() => {
    return Object.fromEntries((properties || []).map((p) => [p.id, p]));
  }, [properties]);

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
    const budget = dashObras.reduce((s, o) => s + (Number(o.budget) || 0), 0);
    const costTotal = allCostsList.reduce((s, x) => s + (Number(x.value) || 0), 0);
    const remaining = Math.max(0, budget - costTotal);
    const totalAreaM2 = dashObras.reduce((s, o) => s + (o.areaM2 != null ? Number(o.areaM2) : 0), 0);
    const costPerM2 = totalAreaM2 > 0 ? costTotal / totalAreaM2 : null;
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
      areaM2: totalAreaM2 || null,
      byCategory,
      byCategoryAll,
      byWorker,
      totalMaoDeObra: byCategory["Mão de obra"] ?? 0,
      totalMaoDeObraAll: byCategoryAll["Mão de obra"] ?? 0,
    };
  }, [dashObras, filteredCosts, costs, workers]);

  const chartByCategory = useMemo(
    () =>
      COST_CATEGORIES.map((cat) => ({ name: cat, value: report.byCategoryAll[cat] || 0 })).filter(
        (d) => d.value > 0
      ),
    [report.byCategoryAll]
  );
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
      const d = c.date ? String(c.date).slice(0, 7) : "";
      if (d) byMonth[d] = (byMonth[d] || 0) + (Number(c.value) || 0);
    });
    return Object.entries(byMonth)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => {
        const [y, m] = key.split("-");
        return { name: `${String(getMonthName(Number(m)) || m).slice(0, 3)}/${y.slice(2)}`, gasto: value };
      });
  }, [yearCosts]);
  const accordionCategories = useMemo(
    () => COST_CATEGORIES.map((cat) => ({ name: cat, value: report.byCategoryAll[cat] || 0 })),
    [report.byCategoryAll]
  );

  const { setPageHeader } = usePageHeader();
  useEffect(() => {
    setPageHeader({
      title: "Obras",
      description: "Gerencie suas obras e reformas.",
      action: (
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingObra(null); setSaveError(null); } }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingObra(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Obra
            </Button>
          </DialogTrigger>
          <DialogContentWithClose
            title={editingObra ? "Editar obra" : "Nova obra"}
            onClose={() => { setDialogOpen(false); setEditingObra(null); setSaveError(null); }}
          >
            {saveError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{saveError}</p>
            )}
            <ObraForm
              obra={editingObra}
              properties={properties}
              onSave={handleSave}
              onCancel={() => { setDialogOpen(false); setEditingObra(null); setSaveError(null); }}
              saving={saving}
            />
          </DialogContentWithClose>
        </Dialog>
      ),
    });
    return () => setPageHeader({ title: null, description: null, action: null });
  }, [setPageHeader, dialogOpen, editingObra, saveError, saving, handleSave]);

  return (
    <div className="space-y-6">
      {activeView !== "tabela" && (
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
                Obras por período
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
      )}

      <PageViewTabs
        value={activeView}
        onValueChange={setActiveView}
        tabelaContent={
      <Card className="rounded-lg border border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">Lista de obras</CardTitle>
          <CardDescription>Clique em Abrir para acessar o dashboard e controles da obra.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonTable rows={5} cols={5} />
          ) : obras.length === 0 ? (
            <EmptyState
              icon={HardHat}
              title="Nenhuma obra cadastrada"
              description="Clique em Nova Obra para registrar uma obra ou reforma."
              action={
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova obra
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-0 bg-muted/40 hover:bg-muted/40">
                  <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Nome</TableHead>
                  <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Imóvel</TableHead>
                  <TableHead className="h-11 px-4 py-3 text-right font-semibold text-foreground tabular-nums">Orçamento</TableHead>
                  <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Início</TableHead>
                  <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Status</TableHead>
                  <TableHead className="h-11 px-4 py-3 text-right font-semibold text-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {
                  obras.map((o) => (
                    <TableRow key={o.id} className="transition-colors">
                      <TableCell className="px-4 py-3 font-medium">{o.name}</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {propertyById[o.propertyId]?.name || "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatCurrency(o.budget)}</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">{formatDate(o.startDate) || "–"}</TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            o.status === "ativa"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {o.status === "ativa" ? "Ativa" : "Concluída"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingObra(o); setDialogOpen(true); }} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(o)} title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button variant="default" size="sm" asChild>
                            <Link href={`/obras/${o.id}`}>
                              Abrir <ArrowRight className="ml-1 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        }
        dashboardContent={dashObras.length > 0 ? (
        <div className="space-y-8 pb-8">
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Indicadores de todas as obras
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ObraStatsCard
                title="Orçamento total"
                value={formatCurrency(report.budget)}
                description={`${dashObras.length} obra(s)`}
                icon={Target}
              />
              <ObraStatsCard
                title="Custo total"
                value={formatCurrency(report.costTotal)}
                description="Acumulado de todas as obras"
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
                  description={`Área total: ${report.areaM2} m²`}
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
                  icon={BarChart3}
                />
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Progresso financeiro
            </h2>
            <ObraFinancialProgress
              budgetLabel="Orçamento total"
              budgetValue={formatCurrency(report.budget)}
              spentLabel="Gasto"
              spentValue={formatCurrency(report.costTotal)}
              remainingLabel="Restante"
              remainingValue={formatCurrency(report.remaining)}
              budgetNumeric={report.budget}
              spentNumeric={report.costTotal}
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
              <CardHeader className={cn("border-b border-border/50", accentCardClasses.construction)}>
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
              <CardHeader className={cn("border-b border-border/50", accentCardClasses.construction)}>
                <CardTitle className="text-base font-semibold">Evolução de gastos</CardTitle>
                <CardDescription>Gastos acumulados por mês (todas as obras)</CardDescription>
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
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Cadastre ao menos uma obra para ver o dashboard.
        </p>
      )}
        insightsContent={(
        <section className="space-y-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Insights
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {dashObras.length === 0 ? (
              <InsightCard icon={HardHat} title="Obras" accent="construction">
                Nenhuma obra cadastrada. Cadastre uma obra para ver indicadores e custos.
              </InsightCard>
            ) : (
              <>
                <InsightCard icon={Target} title="Orçamento e custo" accent="construction">
                  Orçamento total das obras: <strong>{formatCurrency(report.budget)}</strong>.
                  Custo total atual: <strong>{formatCurrency(report.costTotal)}</strong>.
                  Valor restante: <strong>{formatCurrency(report.remaining)}</strong>.
                </InsightCard>
                <InsightCard icon={PieChart} title="Por categoria" accent="construction">
                  {report.costTotal > 0 && report.totalMaoDeObraAll > 0 && (
                    <>Mão de obra representa <strong>{((report.totalMaoDeObraAll / report.costTotal) * 100).toFixed(0)}%</strong> do custo total.</>
                  )}
                  {report.byCategoryAll?.Material > 0 && (
                    <> Material: <strong>{formatCurrency(report.byCategoryAll.Material)}</strong>.</>
                  )}
                </InsightCard>
                <InsightCard icon={BarChart3} title="Resumo" accent="construction">
                  {report.areaM2 > 0 && report.costPerM2 != null && (
                    <>Custo por m²: <strong>{formatCurrency(report.costPerM2)}</strong> (área total {report.areaM2} m²).</>
                  )}
                  {costs.length > 0 && <>{costs.length} registro(s) de custo no total.</>}
                </InsightCard>
              </>
            )}
          </div>
        </section>
      )}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Excluir obra"
        description={deleteConfirm ? "Todos os custos, materiais, etapas e registros vinculados serão removidos. Esta ação não pode ser desfeita." : ""}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </div>
  );
}

function ObraForm({ obra, properties, onSave, onCancel, saving }) {
  const [name, setName] = useState(obra?.name ?? "");
  const [propertyId, setPropertyId] = useState(obra?.propertyId ?? "");
  const [budget, setBudget] = useState(obra?.budget != null ? String(obra.budget) : "");
  const [startDate, setStartDate] = useState(obra?.startDate ?? "");
  const [endDate, setEndDate] = useState(obra?.endDate ?? "");
  const [areaM2, setAreaM2] = useState(obra?.areaM2 != null ? String(obra.areaM2) : "");
  const [status, setStatus] = useState(obra?.status ?? "ativa");

  useEffect(() => {
    setPropertyId(obra?.propertyId ?? "");
  }, [obra?.propertyId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      propertyId: propertyId || null,
      name: name.trim() || "Nova Obra",
      budget: budget !== "" && !isNaN(Number(budget)) ? Number(budget) : 0,
      startDate: startDate || null,
      endDate: endDate || null,
      areaM2: areaM2 !== "" && !isNaN(Number(areaM2)) ? Number(areaM2) : null,
      status,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <label className="text-sm font-medium">Imóvel</label>
        <Select value={propertyId || "none"} onValueChange={(v) => setPropertyId(v === "none" ? "" : v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Selecionar (opcional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {(properties || []).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium">Nome</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          placeholder="Ex: Reforma cozinha"
        />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium">Orçamento inicial (R$)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Data início</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Data previsão fim</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          />
        </div>
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium">Área (m²) — para custo por m²</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={areaM2}
          onChange={(e) => setAreaM2(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          placeholder="Opcional"
        />
      </div>
      {obra && (
        <div className="grid gap-2">
          <label className="text-sm font-medium">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativa">Ativa</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </div>
    </form>
  );
}
