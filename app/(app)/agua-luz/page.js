"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { usePageHeader } from "@/context/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContentWithClose, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { fetchTenants, fetchWaterEnergyConsumption } from "@/lib/api";
import { getCurrentMonthYear } from "@/lib/calculations";
import { WaterEnergyTable } from "@/components/water-energy/WaterEnergyTable";
import { ConsumptionHistoryPanel } from "@/components/water-energy/ConsumptionHistoryPanel";
import { ConsumptionDashboard } from "@/components/water-energy/ConsumptionDashboard";
import { ConsumptionInsights } from "@/components/water-energy/ConsumptionInsights";
import { WaterEnergyConsumptionForm } from "@/components/forms/water-energy-consumption-form";
import { WaterEnergyEditForm } from "@/components/forms/water-energy-edit-form";
import { PageViewTabs } from "@/components/layout/PageViewTabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const idx = (year * 12 + (month - 1)) + delta;
  const newYear = Math.floor(idx / 12);
  const newMonth = (idx % 12) + 1;
  return { month: newMonth, year: newYear };
}

function getMonthName(m) {
  return MONTHS.find((x) => x.value === m)?.label ?? String(m);
}

export default function AguaLuzPage() {
  const [tenants, setTenants] = useState([]);
  const [consumptions, setConsumptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeView, setActiveView] = useState("tabela");
  const [sortBy, setSortBy] = useState("total");
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");

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

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setLoading(true);
      const [tenantsRes, consumptionsRes] = await Promise.all([
        fetchTenants(),
        fetchWaterEnergyConsumption(),
      ]);
      const tenantList = Array.isArray(tenantsRes) ? tenantsRes.filter((t) => t.status === "ativo" && t.isPaymentResponsible === true) : [];
      const consumptionList = Array.isArray(consumptionsRes) ? consumptionsRes : [];
      setTenants(tenantList);
      setConsumptions(consumptionList);
    } catch (e) {
      console.error(e);
      setTenants([]);
      setConsumptions([]);
      setLoadError(e?.message || "Erro ao carregar. Verifique o servidor e o banco.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const consumptionsByTenant = useMemo(() => {
    const map = {};
    consumptions.forEach((c) => {
      if (!map[c.tenantId]) map[c.tenantId] = [];
      map[c.tenantId].push(c);
    });
    Object.keys(map).forEach((id) => {
      map[id].sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));
    });
    return map;
  }, [consumptions]);

  const yearOptions = useMemo(() => {
    const set = new Set();
    consumptions.forEach((c) => {
      const y = Number(c.year);
      if (!Number.isNaN(y)) set.add(y);
    });
    const years = [...set].sort((a, b) => a - b);
    if (years.length === 0) {
      // fallback
      const base = todayYear - 2;
      return Array.from({ length: 6 }, (_, i) => base + i);
    }
    if (!years.includes(todayYear)) years.push(todayYear);
    return years.sort((a, b) => a - b);
  }, [consumptions, todayYear]);

  const tableRows = useMemo(() => {
    const matchesCurrent = (c) => {
      if (reportMonth == null && reportYear == null) return true;
      if (reportMonth == null) return Number(c.year) === Number(reportYear);
      if (reportYear == null) return Number(c.month) === Number(reportMonth);
      return Number(c.month) === Number(reportMonth) && Number(c.year) === Number(reportYear);
    };

    const prev = (() => {
      if (reportMonth == null && reportYear == null) return { type: "none" };
      if (reportMonth != null && reportYear != null) {
        const n = shiftMonth(reportMonth, reportYear, -1);
        return { month: n.month, year: n.year };
      }
      if (reportMonth == null && reportYear != null) {
        return { month: null, year: Number(reportYear) - 1 };
      }
      // reportMonth != null && reportYear == null
      const p = shiftMonth(reportMonth, todayYear, -1);
      return { month: p.month, year: null };
    })();

    const matchesPrev = (c) => {
      if (prev.type === "none") return false;
      if (prev.month == null) return Number(c.year) === Number(prev.year);
      if (prev.year == null) return Number(c.month) === Number(prev.month);
      return Number(c.month) === Number(prev.month) && Number(c.year) === Number(prev.year);
    };

    const prevRecordExists = prev.type !== "none";

    return tenants.map((tenant) => {
      const list = consumptionsByTenant[tenant.id] || [];

      const currList = list.filter(matchesCurrent);
      const prevList = prevRecordExists ? list.filter(matchesPrev) : [];

      const water = currList.reduce((s, c) => s + (Number(c.waterUsage) || 0), 0);
      const electricity = currList.reduce((s, c) => s + (Number(c.electricityUsage) || 0), 0);
      const total = water + electricity;

      const prevTotal = prevList.reduce((s, c) => s + (Number(c.waterUsage) || 0) + (Number(c.electricityUsage) || 0), 0);

      let variation = null;
      if (prevTotal > 0) variation = ((total - prevTotal) / prevTotal) * 100;

      // Representative record for the selected period (used by the history panel)
      const currentRecord = (() => {
        if (currList.length === 0) return null;
        if (reportMonth != null && reportYear != null) {
          return (
            currList.find((c) => Number(c.month) === Number(reportMonth) && Number(c.year) === Number(reportYear)) || null
          );
        }
        const sorted = [...currList].sort((a, b) => (b.year !== a.year ? Number(b.year) - Number(a.year) : Number(b.month) - Number(a.month)));
        return sorted[0] || null;
      })();

      return {
        tenant,
        water,
        electricity,
        total,
        variation,
        currentRecord,
      };
    });
  }, [tenants, consumptionsByTenant, reportMonth, reportYear]);

  const handleRegisterSuccess = useCallback(() => {
    setDialogOpen(false);
    load();
  }, [load]);

  const handleEditClick = useCallback((row) => {
    setEditRow(row);
    setEditDialogOpen(true);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setEditDialogOpen(false);
    setEditRow(null);
    load();
  }, [load]);

  const { setPageHeader } = usePageHeader();
  useEffect(() => {
    setPageHeader({
      title: "Água e Luz",
      description: "Consumo de água e energia por inquilino e mês.",
      action: (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Registrar consumo do mês
            </Button>
          </DialogTrigger>
          <DialogContentWithClose
            title="Registrar consumo do mês"
            onClose={() => setDialogOpen(false)}
          >
            <WaterEnergyConsumptionForm
              tenants={tenants}
              onSuccess={handleRegisterSuccess}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContentWithClose>
        </Dialog>
      ),
    });
    return () => setPageHeader({ title: null, description: null, action: null });
  }, [setPageHeader, dialogOpen, tenants, handleRegisterSuccess]);

  return (
    <div className="space-y-8 pb-8">
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
          <div className="absolute bottom-[18%] right-[6%] h-32 w-32 rounded-full border border-white/40 bg-gradient-to-br from-white/25 to-transparent backdrop-blur-2xl dark:border-white/12 dark:bg-white/[0.06]" />
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
                Água e Luz por período
              </div>
              <h1 className="period-hero-title bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
                {periodLabel}
              </h1>
              <p className="period-hero-text text-sm leading-relaxed sm:text-base">
                Consumo de água e luz abaixo refletem exclusivamente{" "}
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
                    onValueChange={(v) =>
                      setReportMonth(v === "allMonths" ? null : parseInt(v, 10))
                    }
                  >
                    <SelectTrigger className="period-select-trigger h-10 w-full min-w-0">
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
                    <SelectTrigger className="period-select-trigger h-10 w-full min-w-0">
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

      {loadError && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-6">
          <p className="text-center text-muted-foreground">{loadError}</p>
          <Button variant="outline" onClick={() => load()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!loadError && (
        <PageViewTabs
          value={activeView}
          onValueChange={setActiveView}
          tabelaContent={
            <section>
              <WaterEnergyTable
                rows={tableRows}
                loading={loading}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={(by, dir) => {
                  setSortBy(by);
                  setSortDir(dir);
                }}
                search={search}
                onSearch={setSearch}
                onRowClick={(row) => setSelectedTenant(row.tenant)}
                onEdit={handleEditClick}
              />
            </section>
          }
          dashboardContent={
            <section>
              <ConsumptionDashboard
                tenants={tenants}
                consumptions={consumptions}
                tableRows={tableRows}
                currentMonth={reportMonth == null ? todayMonth : reportMonth}
                currentYear={reportYear == null ? todayYear : reportYear}
                loading={loading}
              />
            </section>
          }
          insightsContent={
            <section>
              <ConsumptionInsights
                tenants={tenants}
                consumptions={consumptions}
                tableRows={tableRows}
                currentMonth={reportMonth == null ? todayMonth : reportMonth}
                currentYear={reportYear == null ? todayYear : reportYear}
              />
            </section>
          }
        />
      )}

      {selectedTenant && (
        <ConsumptionHistoryPanel
          tenant={selectedTenant}
          consumptionRecords={consumptionsByTenant[selectedTenant.id] || []}
          onClose={() => setSelectedTenant(null)}
          onRefresh={load}
        />
      )}

      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) setEditRow(null);
      }}>
        <DialogContentWithClose
          title="Editar consumo"
          onClose={() => { setEditDialogOpen(false); setEditRow(null); }}
        >
          {editRow?.currentRecord && (
            <WaterEnergyEditForm
              record={editRow.currentRecord}
              tenantName={editRow.tenant?.name}
              onSuccess={handleEditSuccess}
              onCancel={() => { setEditDialogOpen(false); setEditRow(null); }}
            />
          )}
        </DialogContentWithClose>
      </Dialog>
    </div>
  );
}
