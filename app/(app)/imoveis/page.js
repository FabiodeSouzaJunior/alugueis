"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContentWithClose,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PropertyForm } from "@/components/forms/property-form";
import { PropertyUnitsSection } from "@/components/properties/PropertyUnitsSection";
import { PageViewTabs } from "@/components/layout/PageViewTabs";
import { PropertiesDashboard } from "@/components/properties/PropertiesDashboard";
import { PropertySmartPricing } from "@/components/properties/PropertySmartPricing";
import { InsightCard } from "@/components/ui/insight-card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { fetchProperties, createProperty, updateProperty, deleteProperty, fetchPropertiesDashboard, updatePropertyUnit } from "@/lib/api";
import {
  createTenant,
  fetchTenants,
  generateTenantPayments,
  TenantForm,
  uploadTenantContract,
} from "@/features/tenants";
import { getCurrentMonthYear } from "@/lib/calculations";
import { Plus, Pencil, Trash2, Search, Building2, Percent, Users, MousePointerClick, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonTable } from "@/components/ui/skeleton";

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

function parseUnitResidentIds(unit) {
  if (Array.isArray(unit?.residentTenantIds)) return unit.residentTenantIds.filter(Boolean);
  if (!unit?.residentTenantId) return [];
  return String(unit.residentTenantId)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function shiftMonth(month, year, delta) {
  const idx = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(idx / 12);
  const newMonth = (idx % 12) + 1;
  return { month: newMonth, year: newYear };
}

export default function ImoveisPage() {
  const { setPageHeader } = usePageHeader();
  const [properties, setProperties] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [unitOnlyMode, setUnitOnlyMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [activeView, setActiveView] = useState("tabela");

  const { month: todayMonth, year: todayYear } = getCurrentMonthYear();
  const [reportMonth, setReportMonth] = useState(todayMonth);
  const [reportYear, setReportYear] = useState(todayYear);

  const periodLabel = (() => {
    if (reportMonth == null && reportYear == null) return "Todos os períodos";
    if (reportMonth == null) return `Todos os meses ${reportYear}`;
    if (reportYear == null) {
      const ml = MONTHS.find((m) => m.value === reportMonth)?.label ?? String(reportMonth);
      return `${ml} (todos os anos)`;
    }
    const ml = MONTHS.find((m) => m.value === reportMonth)?.label ?? String(reportMonth);
    return `${ml} ${reportYear}`;
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
  const yearOptions = Array.from({ length: 6 }, (_, i) => todayYear - 2 + i);
  const [tenantsInProperty, setTenantsInProperty] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [editingUnitId, setEditingUnitId] = useState(null);
  const [editingUnit, setEditingUnit] = useState(null);
  const [tenantsForUnitEdit, setTenantsForUnitEdit] = useState([]);
  const [unitForm, setUnitForm] = useState({ unitLabel: "", rentPrice: "", maxPeople: "" });
  const [unitSaveError, setUnitSaveError] = useState(null);
  const [unitSaving, setUnitSaving] = useState(false);
  const [registeringUnit, setRegisteringUnit] = useState(null); // { id, kind: 'payer' | 'resident', property, unit }
  const [residentForm, setResidentForm] = useState({ tenantId: "", residentTenantIds: [] });
  const [residentSearch, setResidentSearch] = useState("");
  const [creatingTenantInline, setCreatingTenantInline] = useState(false);
  const [inlineTenantSaving, setInlineTenantSaving] = useState(false);
  const [inlineTenantError, setInlineTenantError] = useState(null);
  const [tenantsForExpanded, setTenantsForExpanded] = useState([]);
  const [unitTenantsDialog, setUnitTenantsDialog] = useState({
    open: false,
    propertyName: "",
    unitLabel: "",
    tenants: [],
  });

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setLoading(true);
      const data = await fetchProperties();
      setProperties(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setProperties([]);
      setLoadError(e?.message || "Erro ao carregar. Verifique se a tabela 'properties' existe no banco.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      setDashboardLoading(true);
      const data = await fetchPropertiesDashboard();
      setDashboard(data);
    } catch (e) {
      console.error(e);
      setDashboard(null);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (activeView === "dashboard" || activeView === "insights") {
      loadDashboard();
    }
  }, [activeView, loadDashboard]);

  useEffect(() => {
    if (!editingProperty?.id) {
      setTenantsInProperty([]);
      return;
    }
    fetchTenants({ propertyId: editingProperty.id })
      .then((list) => setTenantsInProperty(Array.isArray(list) ? list : []))
      .catch(() => setTenantsInProperty([]));
  }, [editingProperty?.id]);

  useEffect(() => {
    if (!dialogOpen || !editingProperty?.id) return;
    const updated = properties.find((p) => p.id === editingProperty.id);
    if (updated && JSON.stringify(updated.units || []) !== JSON.stringify(editingProperty.units || [])) {
      setEditingProperty(updated);
    }
  }, [properties, dialogOpen, editingProperty?.id, editingProperty?.units]);

  useEffect(() => {
    if (!expandedId) {
      setTenantsForExpanded([]);
      return;
    }
    fetchTenants()
      .then((list) => setTenantsForExpanded(Array.isArray(list) ? list : []))
      .catch(() => setTenantsForExpanded([]));
  }, [expandedId]);

  useEffect(() => {
    if (!editingUnit?.property?.id) {
      setTenantsForUnitEdit([]);
      return;
    }
    fetchTenants({ propertyId: editingUnit.property.id })
      .then((list) => setTenantsForUnitEdit(Array.isArray(list) ? list : []))
      .catch(() => setTenantsForUnitEdit([]));
  }, [editingUnit?.property?.id]);

  useEffect(() => {
    if (editingUnit?.unit) {
      const u = editingUnit.unit;
      setUnitForm({
        unitLabel: u.unitLabel || "",
        rentPrice: u.rentPrice != null ? String(u.rentPrice) : "",
        maxPeople: u.maxPeople != null ? String(u.maxPeople) : "",
      });
      setUnitSaveError(null);
    }
  }, [editingUnit?.unit]);

  const handleSave = useCallback(async (payload) => {
    setSaveError(null);
    try {
      if (editingProperty) {
        await updateProperty(editingProperty.id, payload);
      } else {
        await createProperty(payload);
      }
      setDialogOpen(false);
      setEditingProperty(null);
      await load();
      if (activeView !== "tabela") await loadDashboard();
    } catch (e) {
      console.error(e);
      setSaveError(e?.message || "Erro ao salvar. Tente novamente.");
    }
  }, [editingProperty, load, loadDashboard, activeView]);

  const handleSaveUnit = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!editingUnit?.property?.id || !editingUnit?.unit?.id) return;
    setUnitSaveError(null);
    setUnitSaving(true);
    try {
      const rentPrice = unitForm.rentPrice.trim() !== "" ? Number(String(unitForm.rentPrice).replace(",", ".")) : null;
      const maxPeople = unitForm.maxPeople.trim() !== "" ? Math.max(0, parseInt(unitForm.maxPeople, 10) || 0) : null;
      await updatePropertyUnit(editingUnit.property.id, editingUnit.unit.id, {
        unitLabel: unitForm.unitLabel?.trim() || null,
        rentPrice,
        maxPeople,
      });
      setEditingUnit(null);
      await load();
    } catch (err) {
      console.error(err);
      setUnitSaveError(err?.message || "Erro ao salvar. Tente novamente.");
    } finally {
      setUnitSaving(false);
    }
  }, [editingUnit, unitForm, load]);

  const handleSaveUnitResidents = useCallback(async (property, unit, kind) => {
    if (!property?.id || !unit?.id || !kind) return;
    setUnitSaving(true);
    try {
      const tenantId =
        kind === "payer" ? residentForm.tenantId || null : unit.tenantId ?? null;
      const residentTenantIds =
        kind === "resident"
          ? (Array.isArray(residentForm.residentTenantIds) ? residentForm.residentTenantIds : [])
          : parseUnitResidentIds(unit);
      await updatePropertyUnit(property.id, unit.id, {
        unitLabel: unit.unitLabel ?? null,
        rentPrice: unit.rentPrice ?? null,
        maxPeople: unit.maxPeople ?? null,
        tenantId,
        residentTenantIds,
      });
      setRegisteringUnit(null);
      setResidentForm({ tenantId: "", residentTenantIds: [] });
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setUnitSaving(false);
    }
  }, [residentForm, load]);

  const handleCreateTenantInline = useCallback(async (payload) => {
    const name = (payload?.name || "").trim();
    if (!name) {
      setInlineTenantError("Nome é obrigatório.");
      return;
    }

    // Extract contract file from payload (injected by TenantForm)
    const contractFile = payload.__contractFile || null;
    delete payload.__contractFile;
    delete payload.__contractRemoved;

    setInlineTenantSaving(true);
    setInlineTenantError(null);
    try {
      const propertyId = registeringUnit?.property?.id || null;
      const newTenant = await createTenant({
        name,
        ...payload,
        name,
        propertyId: payload?.propertyId ?? propertyId,
        unitId: payload?.unitId ?? registeringUnit?.unit?.id ?? null,
      });
      if (newTenant && newTenant.isPaymentResponsible && newTenant.status === "ativo" && newTenant.startDate) {
        await generateTenantPayments(newTenant.id, newTenant.rentValue, newTenant.startDate);
      }

      // Upload contract if provided
      if (contractFile && newTenant?.id) {
        try {
          await uploadTenantContract(newTenant.id, contractFile);
        } catch (uploadErr) {
          console.error("Erro ao enviar contrato:", uploadErr);
        }
      }

      const [refreshedTenants] = await Promise.all([
        fetchTenants(),
        load(),
      ]);
      setTenantsForExpanded(Array.isArray(refreshedTenants) ? refreshedTenants : []);

      if (registeringUnit?.kind === "payer") {
        setResidentForm((f) => ({ ...f, tenantId: newTenant.id }));
      } else {
        setResidentForm((f) => ({
          ...f,
          residentTenantIds: Array.from(new Set([...(f.residentTenantIds || []), newTenant.id])),
        }));
      }

      setCreatingTenantInline(false);
    } catch (err) {
      console.error(err);
      setInlineTenantError(err?.message || "Erro ao criar inquilino.");
    } finally {
      setInlineTenantSaving(false);
    }
  }, [load, registeringUnit]);

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteProperty(deleteConfirm.id);
      setDeleteConfirm(null);
      await load();
      if (activeView !== "tabela") await loadDashboard();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenUnitTenantsDialog = (property, unit) => {
    const list = [];
    if (unit?.tenantId || unit?.tenantName) {
      list.push({
        id: unit.tenantId || `payer-${unit.id}`,
        name: unit.tenantName || "Inquilino sem nome",
        role: "Responsável pelo pagamento",
      });
    }
    const residents = Array.isArray(unit?.residentNames) ? unit.residentNames : [];
    if (residents.length > 0) {
      residents.forEach((name, idx) => {
        list.push({
          id: `${unit.id}-resident-${idx}`,
          name: name || "Inquilino sem nome",
          role: "Morador da unidade",
        });
      });
    } else if (unit?.residentTenantId || unit?.residentName) {
      list.push({
        id: unit.residentTenantId || `resident-${unit.id}`,
        name: unit.residentName || "Inquilino sem nome",
        role: "Morador da unidade",
      });
    }
    setUnitTenantsDialog({
      open: true,
      propertyName: property?.name || "Imóvel",
      unitLabel: unit?.unitLabel || "Sem identificador",
      tenants: list,
    });
  };

  useEffect(() => {
    setPageHeader({
      title: "Imóveis",
      description: "Gerencie imóveis, unidades, capacidade e ocupação.",
      action: (
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingProperty(null); setEditingUnitId(null); setUnitOnlyMode(false); } setSaveError(null); }}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                const selectedProperty = properties.find((p) => p.id === expandedId) || null;
                if (selectedProperty) {
                  setEditingProperty(selectedProperty);
                  setEditingUnitId(null);
                  setUnitOnlyMode(true);
                } else {
                  setEditingProperty(null);
                  setEditingUnitId(null);
                  setUnitOnlyMode(false);
                }
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {expandedId ? "Adicionar unidade" : "Adicionar imóvel"}
            </Button>
          </DialogTrigger>
          <DialogContentWithClose
            className="w-[min(96vw,860px)] max-w-none overflow-y-auto max-h-[90vh]"
            title={unitOnlyMode ? "Adicionar unidade" : (editingProperty ? "Editar imóvel" : "Adicionar imóvel")}
            onClose={() => { setDialogOpen(false); setEditingProperty(null); setEditingUnitId(null); setUnitOnlyMode(false); setSaveError(null); }}
          >
            {saveError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive mb-4">
                {saveError}
              </p>
            )}
            {!unitOnlyMode && (
              <PropertyForm
                property={editingProperty}
                onSave={handleSave}
                onCancel={() => { setDialogOpen(false); setEditingProperty(null); setEditingUnitId(null); setUnitOnlyMode(false); setSaveError(null); }}
              />
            )}
            {editingProperty?.id && (
              <PropertyUnitsSection
                propertyId={editingProperty.id}
                units={editingProperty.units || []}
                tenantsInProperty={tenantsInProperty}
                onUpdate={load}
                initialEditUnitId={editingUnitId}
                initialAdding={unitOnlyMode}
              />
            )}
          </DialogContentWithClose>
        </Dialog>
      ),
    });
    return () => setPageHeader({ title: null, description: null, action: null });
  }, [setPageHeader, dialogOpen, editingProperty, saveError, handleSave]);

  const filtered = properties.filter(
    (p) =>
      !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      (p.observacoes && p.observacoes.toLowerCase().includes(search.toLowerCase()))
  );

  const occupiedTenantUnitById = useMemo(() => {
    const map = new Map();
    (properties || []).forEach((property) => {
      (property?.units || []).forEach((unit) => {
        const linkedIds = [unit?.tenantId, ...parseUnitResidentIds(unit)].filter(Boolean);
        linkedIds.forEach((tenantId) => {
          if (!map.has(tenantId)) {
            map.set(tenantId, {
              propertyId: property?.id || null,
              unitId: unit?.id || null,
            });
          }
        });
      });
    });
    return map;
  }, [properties]);

  const availableTenantsForRegistering = useMemo(() => {
    if (!registeringUnit) return tenantsForExpanded;
    const currentUnit = registeringUnit?.unit || null;
    const currentUnitId = currentUnit?.id || null;
    const currentUnitTenantIds = new Set(
      [currentUnit?.tenantId, ...parseUnitResidentIds(currentUnit)].filter(Boolean)
    );

    return (tenantsForExpanded || []).filter((tenant) => {
      const occupiedRef = occupiedTenantUnitById.get(tenant.id);
      if (!occupiedRef) return true;
      if (currentUnitTenantIds.has(tenant.id)) return true;
      return occupiedRef.unitId === currentUnitId;
    });
  }, [tenantsForExpanded, occupiedTenantUnitById, registeringUnit]);

  const eligiblePayerTenantsForRegistering = useMemo(
    () =>
      (availableTenantsForRegistering || []).filter((tenant) =>
        Boolean(String(tenant?.email || "").trim())
      ),
    [availableTenantsForRegistering]
  );

  const unavailablePayerTenantsCount = Math.max(
    0,
    (availableTenantsForRegistering || []).length - eligiblePayerTenantsForRegistering.length
  );

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
                Imóveis por período
              </div>
              <h1 className="period-hero-title bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
                {periodLabel}
              </h1>
              <p className="period-hero-text text-sm leading-relaxed sm:text-base">
                Seletor de período para manter o padrão dos dashboards.
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
          <>
          <Card className="rounded-lg border border-border">
            <CardHeader className="pb-4">
              <CardTitle>Listagem</CardTitle>
              <CardDescription>
                Imóveis cadastrados. Veja abaixo as unidades de cada imóvel.
              </CardDescription>
              <div className="mt-3 flex items-center gap-3 rounded-lg border-2 border-amber-500/40 bg-amber-500/10 px-4 py-3">
                <MousePointerClick className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Clique no imóvel para ver as unidades.
                </p>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="relative max-w-xs flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou observações..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <SkeletonTable rows={5} cols={6} />
              ) : loadError ? (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <p className="text-center text-muted-foreground">{loadError}</p>
                  <Button variant="outline" onClick={() => load()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="Nenhum imóvel"
                  description="Adicione o primeiro imóvel para gerenciar unidades, capacidade e ocupação."
                />
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filtered.map((p) => {
                      const isExpanded = expandedId === p.id;
                      return (
                        <div
                          key={p.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setExpandedId(isExpanded ? null : p.id)}
                          onKeyDown={(e) => e.key === "Enter" && setExpandedId(isExpanded ? null : p.id)}
                          className={cn(
                            "aspect-square min-h-[120px] rounded-xl border-2 flex flex-col items-center justify-center gap-2 p-4 cursor-pointer transition-all",
                            "border-sky-500/60 bg-sky-500/10 hover:bg-sky-500/20 hover:border-sky-500",
                            "dark:border-sky-400/60 dark:bg-sky-500/15 dark:hover:bg-sky-500/25",
                            isExpanded && "ring-2 ring-sky-500 ring-offset-2 ring-offset-background"
                          )}
                        >
                          <Building2 className="w-[40%] h-[40%] min-w-12 min-h-12 shrink-0 text-sky-600 dark:text-sky-400" />
                          <span className="text-xl font-semibold text-center text-foreground line-clamp-2 leading-tight">
                            {p.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {expandedId && (() => {
                    const p = filtered.find((prop) => prop.id === expandedId);
                    if (!p) return null;
                    const units = p.units || [];
                    return (
                      <div className="rounded-xl border-2 border-sky-500/40 bg-sky-500/5 dark:bg-sky-500/10 p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-lg font-semibold text-foreground">
                            Unidades — {p.name}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingProperty(p);
                                setUnitOnlyMode(true);
                                setDialogOpen(true);
                              }}
                              title="Adicionar unidade"
                            >
                              <Plus className="mr-1 h-3.5 w-3.5" />
                              Adicionar unidade
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingProperty(p);
                                setUnitOnlyMode(false);
                                setDialogOpen(true);
                              }}
                              title="Editar imóvel"
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirm(p)}
                              title="Excluir imóvel"
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Excluir
                            </Button>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                        <Table className="min-w-[640px]">
                          <TableHeader>
                            <TableRow className="border-sky-500/20 hover:bg-transparent">
                              <TableHead className="w-28">Identificador</TableHead>
                              <TableHead className="tabular-nums w-32">Preço do aluguel</TableHead>
                              <TableHead className="w-28">Qtd. máx.</TableHead>
                              <TableHead>Responsável</TableHead>
                              <TableHead>Quem mora</TableHead>
                              <TableHead className="text-right w-16">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {units.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-muted-foreground text-center py-8">
                                  Nenhuma unidade cadastrada. Use &quot;Adicionar unidade&quot; acima para cadastrar.
                                </TableCell>
                              </TableRow>
                            ) : (
                              units.map((u) => (
                                <TableRow key={u.id} className="border-sky-500/10">
                                    <TableCell className="font-medium">{u.unitLabel || "—"}</TableCell>
                                    <TableCell className="tabular-nums">{u.rentPrice != null ? formatCurrency(u.rentPrice) : "—"}</TableCell>
                                    <TableCell>{u.maxPeople != null ? u.maxPeople : "—"}</TableCell>
                                    <TableCell className="align-middle">
                                      <div className="flex flex-col items-start gap-2">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          {u.tenantName ? (
                                            <Badge
                                              variant="secondary"
                                              className="gap-1 pr-2 text-xs font-normal"
                                            >
                                              <span className="opacity-80" aria-hidden>
                                                👤
                                              </span>
                                              {u.tenantName}
                                            </Badge>
                                          ) : null}
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-fit text-xs"
                                            onClick={() => {
                                              const open =
                                                registeringUnit?.id === u.id && registeringUnit?.kind === "payer";
                                              setResidentForm({
                                                tenantId: u.tenantId || "",
                                                residentTenantIds: parseUnitResidentIds(u),
                                              });
                                              setResidentSearch("");
                                              setRegisteringUnit(open ? null : { id: u.id, kind: "payer", property: p, unit: u });
                                            }}
                                          >
                                            Registrar
                                          </Button>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="align-middle">
                                      <div className="flex flex-col gap-2">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-fit text-xs"
                                            onClick={() => {
                                              const open =
                                                registeringUnit?.id === u.id && registeringUnit?.kind === "resident";
                                              setResidentForm({
                                                tenantId: u.tenantId || "",
                                                residentTenantIds: parseUnitResidentIds(u),
                                              });
                                              setResidentSearch("");
                                              setRegisteringUnit(open ? null : { id: u.id, kind: "resident", property: p, unit: u });
                                            }}
                                          >
                                            Registrar
                                          </Button>
                                        </div>
                                        <button
                                          type="button"
                                          className="w-fit text-left text-xs font-medium text-primary underline-offset-4 hover:underline"
                                          onClick={() => handleOpenUnitTenantsDialog(p, u)}
                                        >
                                          Ver inquilinos
                                        </button>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right align-middle">
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingUnit({ unit: u, property: p })} title="Editar unidade">
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          <PropertySmartPricing
            properties={properties}
            formatCurrency={formatCurrency}
          />
          </>
        }
        dashboardContent={
          <PropertiesDashboard dashboard={dashboard} loading={dashboardLoading && !dashboard} />
        }
        insightsContent={
          dashboard?.stats ? (
            <section className="space-y-6">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Insights
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <InsightCard icon={Building2} title="Portfólio" accent="property">
                  Total de <strong>{dashboard.stats.totalProperties}</strong> imóveis e{" "}
                  <strong>{dashboard.stats.totalUnits}</strong> unidades cadastradas.
                </InsightCard>
                <InsightCard icon={Users} title="Moradores" accent="property">
                  <strong>{dashboard.stats.totalMoradores}</strong> pessoas nos imóveis.
                  Taxa média de ocupação: <strong>{dashboard.stats.avgOccupancy}%</strong>.
                </InsightCard>
                <InsightCard icon={Percent} title="Ocupação" accent="property">
                  Use os campos &quot;Máximo de pessoas&quot; e &quot;Quantidade atual&quot; em cada imóvel
                  para acompanhar capacidade e ocupação no dashboard.
                </InsightCard>
              </div>
            </section>
          ) : (
            <section className="space-y-6">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Insights
              </h2>
              <p className="text-muted-foreground">
                Cadastre imóveis na aba Tabela e visualize indicadores e gráficos no Dashboard.
              </p>
            </section>
          )
        }
      />

      <Dialog
        open={unitTenantsDialog.open}
        onOpenChange={(open) => setUnitTenantsDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContentWithClose
          title={`Inquilinos da unidade ${unitTenantsDialog.unitLabel}`}
          description={`Imóvel: ${unitTenantsDialog.propertyName}`}
          onClose={() => setUnitTenantsDialog((prev) => ({ ...prev, open: false }))}
        >
          {unitTenantsDialog.tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum inquilino registrado nesta unidade.
            </p>
          ) : (
            <ul className="max-h-64 list-disc space-y-1 overflow-y-auto pl-5 text-sm">
              {unitTenantsDialog.tenants.map((t) => (
                <li key={t.id}>
                  {t.name}
                  {t.role ? ` — ${t.role}` : ""}
                </li>
              ))}
            </ul>
          )}
        </DialogContentWithClose>
      </Dialog>

      <Dialog
        open={!!registeringUnit}
        onOpenChange={(open) => {
          if (!open) {
            setRegisteringUnit(null);
            setResidentForm({ tenantId: "", residentTenantIds: [] });
            setResidentSearch("");
            setCreatingTenantInline(false);
            setInlineTenantError(null);
          }
        }}
      >
        <DialogContentWithClose
          className="flex h-[min(92vh,860px)] w-[min(96vw,1080px)] max-w-none flex-col overflow-hidden p-0"
          headerClassName="border-b border-border bg-background px-6 py-5"
          contentClassName="flex-1 min-h-0 overflow-hidden bg-muted/10 px-6 py-5"
          title={
            registeringUnit?.kind === "payer"
              ? "Registrar responsável da unidade"
              : "Registrar moradores da unidade"
          }
          description={
            registeringUnit?.unit?.unitLabel
              ? `Unidade ${registeringUnit.unit.unitLabel} — ${registeringUnit?.property?.name || "Imóvel"}`
              : (registeringUnit?.property?.name || "Imóvel")
          }
          onClose={() => {
            setRegisteringUnit(null);
            setResidentForm({ tenantId: "", residentTenantIds: [] });
            setResidentSearch("");
            setCreatingTenantInline(false);
            setInlineTenantError(null);
          }}
        >
          {registeringUnit?.kind === "payer" ? (
            creatingTenantInline ? (
              <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    onClick={() => { setCreatingTenantInline(false); setInlineTenantError(null); }}
                  >
                    &larr; Voltar para lista
                  </button>
                </div>
                <p className="text-sm font-medium">Criar novo inquilino</p>
                {inlineTenantError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{inlineTenantError}</p>
                )}
                <TenantForm
                  properties={properties}
                  initialValues={{
                    propertyId: registeringUnit?.property?.id || "",
                    unitId: registeringUnit?.unit?.id || "",
                    kitnetNumber: registeringUnit?.unit?.unitLabel || "",
                    isPaymentResponsible: true,
                    status: "ativo",
                  }}
                  lockedFields={{ propertyId: true, unitId: true }}
                  onSave={handleCreateTenantInline}
                  onCancel={() => { setCreatingTenantInline(false); setInlineTenantError(null); }}
                  submitLabel={inlineTenantSaving ? "Criando..." : "Criar e selecionar"}
                  submitting={inlineTenantSaving}
                />
              </div>
            ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveUnitResidents(registeringUnit.property, registeringUnit.unit, "payer");
              }}
            >
              <div className="grid gap-2">
                <Label>Inquilino responsável pelo pagamento</Label>
                <Select
                  value={residentForm.tenantId || "none"}
                  onValueChange={(v) =>
                    setResidentForm((f) => ({ ...f, tenantId: v === "none" ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {eligiblePayerTenantsForRegistering.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {unavailablePayerTenantsCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {unavailablePayerTenantsCount} inquilino(s) ocultado(s) porque ainda nao possuem email cadastrado.
                  </p>
                )}
                {eligiblePayerTenantsForRegistering.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Nenhum inquilino elegivel para pagamento. Cadastre ou edite um inquilino com email para continuar.
                  </p>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit gap-1.5 text-xs text-primary"
                  onClick={() => { setCreatingTenantInline(true); setInlineTenantError(null); }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Criar novo inquilino
                </Button>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRegisteringUnit(null);
                    setResidentForm({ tenantId: "", residentTenantIds: [] });
                    setResidentSearch("");
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={unitSaving}>
                  {unitSaving ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
            )
          ) : (
            creatingTenantInline ? (
              <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    onClick={() => { setCreatingTenantInline(false); setInlineTenantError(null); }}
                  >
                    &larr; Voltar para lista
                  </button>
                </div>
                <p className="text-sm font-medium">Criar novo inquilino</p>
                {inlineTenantError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{inlineTenantError}</p>
                )}
                <TenantForm
                  properties={properties}
                  initialValues={{
                    propertyId: registeringUnit?.property?.id || "",
                    unitId: registeringUnit?.unit?.id || "",
                    kitnetNumber: registeringUnit?.unit?.unitLabel || "",
                    isPaymentResponsible: false,
                    status: "ativo",
                  }}
                  lockedFields={{ propertyId: true, unitId: true }}
                  onSave={handleCreateTenantInline}
                  onCancel={() => { setCreatingTenantInline(false); setInlineTenantError(null); }}
                  submitLabel={inlineTenantSaving ? "Criando..." : "Criar e selecionar"}
                  submitting={inlineTenantSaving}
                />
              </div>
            ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveUnitResidents(registeringUnit?.property, registeringUnit?.unit, "resident");
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <Label>Quem mora nesta unidade</Label>
                <Badge variant="secondary">
                  {(residentForm.residentTenantIds || []).length} selecionado(s)
                </Badge>
              </div>
              <div className="grid gap-2">
                <Input
                  value={residentSearch}
                  onChange={(e) => setResidentSearch(e.target.value)}
                  placeholder="Buscar inquilino por nome..."
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const filteredIds = (availableTenantsForRegistering || [])
                      .filter((t) =>
                        (t?.name || "")
                          .toLowerCase()
                          .includes((residentSearch || "").trim().toLowerCase())
                      )
                      .map((t) => t.id)
                      .filter(Boolean);
                    setResidentForm((f) => {
                      const current = Array.isArray(f.residentTenantIds) ? f.residentTenantIds : [];
                      return {
                        ...f,
                        residentTenantIds: Array.from(new Set([...current, ...filteredIds])),
                      };
                    });
                  }}
                >
                  Selecionar filtrados
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setResidentForm((f) => ({ ...f, residentTenantIds: [] }))}
                >
                  Limpar
                </Button>
              </div>
              <div className="max-h-64 space-y-1 overflow-auto rounded border border-border bg-background p-3">
                {availableTenantsForRegistering
                  .filter((t) =>
                    (t?.name || "")
                      .toLowerCase()
                      .includes((residentSearch || "").trim().toLowerCase())
                  )
                  .map((t) => {
                    const checked = (residentForm.residentTenantIds || []).includes(t.id);
                    return (
                      <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setResidentForm((f) => {
                              const current = Array.isArray(f.residentTenantIds) ? f.residentTenantIds : [];
                              return {
                                ...f,
                                residentTenantIds: e.target.checked
                                  ? Array.from(new Set([...current, t.id]))
                                  : current.filter((id) => id !== t.id),
                              };
                            })
                          }
                        />
                        <span>{t.name}</span>
                      </label>
                    );
                  })}
                {(availableTenantsForRegistering || []).filter((t) =>
                  (t?.name || "").toLowerCase().includes((residentSearch || "").trim().toLowerCase())
                ).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum inquilino encontrado para a busca.
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit gap-1.5 text-xs text-primary"
                onClick={() => { setCreatingTenantInline(true); setInlineTenantError(null); }}
              >
                <Plus className="h-3.5 w-3.5" />
                Criar novo inquilino
              </Button>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRegisteringUnit(null);
                    setResidentForm({ tenantId: "", residentTenantIds: [] });
                    setResidentSearch("");
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={unitSaving}>
                  {unitSaving ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
            )
          )}
        </DialogContentWithClose>
      </Dialog>

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Excluir imóvel"
        description={`Tem certeza que deseja excluir "${deleteConfirm?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
        confirmLabel="Excluir"
        variant="destructive"
        loading={deleting}
      />

      <Dialog open={!!editingUnit} onOpenChange={(open) => !open && setEditingUnit(null)}>
        <DialogContentWithClose
          title="Editar unidade"
          onClose={() => setEditingUnit(null)}
        >
          {editingUnit && (
            <form onSubmit={handleSaveUnit} className="space-y-4">
              {unitSaveError && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {unitSaveError}
                </p>
              )}
              <div className="grid gap-2">
                <Label htmlFor="unit-label">Identificador</Label>
                <Input
                  id="unit-label"
                  placeholder="Ex: 101"
                  value={unitForm.unitLabel}
                  onChange={(e) => setUnitForm((f) => ({ ...f, unitLabel: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit-rent">Preço do aluguel (R$ mensal)</Label>
                <Input
                  id="unit-rent"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0,00"
                  value={unitForm.rentPrice}
                  onChange={(e) => setUnitForm((f) => ({ ...f, rentPrice: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit-max">Quantidade máxima de pessoas</Label>
                <Input
                  id="unit-max"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={unitForm.maxPeople}
                  onChange={(e) => setUnitForm((f) => ({ ...f, maxPeople: e.target.value }))}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingUnit(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={unitSaving}>
                  {unitSaving ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContentWithClose>
      </Dialog>
    </div>
  );
}
