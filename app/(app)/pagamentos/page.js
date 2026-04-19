"use client";

import { Suspense, useEffect, useState, useCallback, useMemo, Fragment } from "react";
import { useSearchParams } from "next/navigation";
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
import { PaymentForm } from "@/components/forms/payment-form";
import { PaymentsAnalyticsStats } from "@/components/payments-analytics/PaymentsAnalyticsStats";
import { PaymentsStatusDistribution } from "@/components/payments-analytics/PaymentsStatusDistribution";
import { PaymentsRevenueTimeline } from "@/components/payments-analytics/PaymentsRevenueTimeline";
import { PaymentsRevenueProgress } from "@/components/payments-analytics/PaymentsRevenueProgress";
import { PaymentsTopDebts } from "@/components/payments-analytics/PaymentsTopDebts";
import { WithdrawalSection } from "@/components/payments-analytics/WithdrawalSection";
import { formatCurrency, formatDate, getMonthName, cn } from "@/lib/utils";
import { accentCardClasses } from "@/lib/chartColors";
import {
  fetchPayments,
  fetchTenantPaymentHistory,
  fetchTenants,
  fetchProperties,
  createPayment,
  updatePayment,
  fetchCondominiumSettings,
  fetchCondominiumOverview,
} from "@/lib/api";
import { getPendingAmount, getCurrentMonthYear } from "@/lib/calculations";
import {
  Plus,
  Pencil,
  Search,
  MousePointerClick,
  BarChart3,
  TrendingUp,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { usePageHeader } from "@/context/page-header";
import { PageViewTabs } from "@/components/layout/PageViewTabs";
import { InsightCard } from "@/components/ui/insight-card";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: getMonthName(i + 1),
}));

function shiftMonth(month, year, delta) {
  const idx = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(idx / 12);
  const newMonth = (idx % 12) + 1;
  return { month: newMonth, year: newYear };
}

function PagamentosContent() {
  const searchParams = useSearchParams();
  const { setPageHeader } = usePageHeader();
  const [payments, setPaymentsState] = useState([]);
  const [allPayments, setAllPaymentsState] = useState([]);
  const [tenants, setTenantsState] = useState([]);
  const [properties, setPropertiesState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reportMonth, setReportMonth] = useState(() => getCurrentMonthYear().month);
  const [reportYear, setReportYear] = useState(() => getCurrentMonthYear().year);
  const [filterKitnet, setFilterKitnet] = useState("__all__");
  const [filterPropertyId, setFilterPropertyId] = useState("__all__");
  const [filterTenantId, setFilterTenantId] = useState("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [expandedTenantId, setExpandedTenantId] = useState(null);
  const [tenantHistoryById, setTenantHistoryById] = useState({});
  const [loadingTenantHistoryId, setLoadingTenantHistoryId] = useState(null);
  const [condominiumByProperty, setCondominiumByProperty] = useState({});
  // condominiumByProperty = { [propertyId]: { chargeWithRent: bool, byPeriod: { "year-month": amount } } }
  const [activeView, setActiveView] = useState("tabela");

  const { month: todayMonth, year: todayYear } = getCurrentMonthYear();
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
    if (!searchParams) return;
    const tid = searchParams.get("tenantId");
    if (tid) setFilterTenantId(tid);
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setLoading(true);
      const paymentParams = {};
      if (reportMonth != null) paymentParams.month = reportMonth;
      if (reportYear != null) paymentParams.year = reportYear;
      const [pData, allPData, tData, propertiesData] = await Promise.all([
        fetchPayments(paymentParams),
        fetchPayments({}),
        fetchTenants({ financialOnly: true }),
        fetchProperties().catch(() => []),
      ]);
      const list = Array.isArray(pData) ? pData : [];
      setPaymentsState(list);
      setAllPaymentsState(Array.isArray(allPData) ? allPData : []);
      const tenantsList = Array.isArray(tData) ? tData : [];
      setTenantsState(tenantsList);
      const propsList = Array.isArray(propertiesData) ? propertiesData : [];
      setPropertiesState(propsList);

      // Buscar condomínio por imóvel: para cada imóvel que tem inquilinos, buscar settings + overview
      const propertyIds = [...new Set(tenantsList.map((t) => t.propertyId).filter(Boolean))];

      const ys = (list || [])
        .map((p) => ({ y: Number(p.year), m: Number(p.month) }))
        .filter((x) => !isNaN(x.y) && !isNaN(x.m) && x.m >= 1 && x.m <= 12);
      const earliestYM = ys.length ? Math.min(...ys.map((x) => x.y * 12 + x.m)) : null;
      const latestYM = ys.length ? Math.max(...ys.map((x) => x.y * 12 + x.m)) : null;
      const historyMonths = earliestYM != null && latestYM != null && latestYM >= earliestYM
        ? Math.max(60, latestYM - earliestYM + 1)
        : 60;

      const condByProp = {};
      await Promise.all(
        propertyIds.map(async (propId) => {
          try {
            const [settings, overview] = await Promise.all([
              fetchCondominiumSettings(propId).catch(() => ({ chargeWithRent: true })),
              fetchCondominiumOverview({
                month: reportMonth ?? todayMonth,
                year: reportYear ?? todayYear,
                historyMonths,
                propertyId: propId,
              }).catch(() => ({ billingHistory: [] })),
            ]);
            const byPeriod = {};
            if (overview?.billingHistory?.length) {
              overview.billingHistory.forEach((row) => {
                byPeriod[`${row.year}-${row.month}`] = Number(row.totalValue) || 0;
              });
            }
            condByProp[propId] = {
              chargeWithRent: settings?.chargeWithRent !== false,
              byPeriod,
            };
          } catch {
            condByProp[propId] = { chargeWithRent: false, byPeriod: {} };
          }
        })
      );
      setCondominiumByProperty(condByProp);
      return list;
    } catch (e) {
      console.error(e);
      setPaymentsState([]);
      setAllPaymentsState([]);
      setTenantsState([]);
      setPropertiesState([]);
      setTenantHistoryById({});
      setLoadError(e?.message || "Erro ao carregar. Verifique o servidor e o banco.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [reportMonth, reportYear, todayMonth, todayYear]);

  useEffect(() => {
    load();
  }, [load]);

  const ensureTenantHistory = useCallback(async (tenantId) => {
    if (!tenantId) return [];
    if (tenantHistoryById[tenantId]) return tenantHistoryById[tenantId];

    setLoadingTenantHistoryId(tenantId);
    try {
      const history = await fetchTenantPaymentHistory(tenantId);
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

  const handleSave = useCallback(async (payload) => {
    setSaveError(null);
    setSaving(true);
    try {
      const pay = {
        tenantId: payload.tenantId != null && payload.tenantId !== "" ? String(payload.tenantId) : null,
        month: Number(payload.month) ?? 1,
        year: Number(payload.year) ?? new Date().getFullYear(),
        expectedAmount: payload.expectedAmount != null ? Number(payload.expectedAmount) : null,
        amount: Number(payload.amount) ?? 0,
        dueDate: payload.dueDate || null,
        status: payload.status || "pendente",
      };
      const paymentId = editingPayment?.id;
      let updatedId = paymentId;
      if (paymentId) {
        await updatePayment(paymentId, pay);
      } else {
        if (!pay.tenantId) {
          setSaveError("Selecione o inquilino para registrar o pagamento.");
          setSaving(false);
          return;
        }
        const existing = payments.find(
          (p) =>
            String(p.tenantId) === String(pay.tenantId) &&
            Number(p.month) === Number(pay.month) &&
            Number(p.year) === Number(pay.year)
        );
        if (existing) {
          await updatePayment(existing.id, pay);
          updatedId = existing.id;
        } else {
          const created = await createPayment(pay);
          updatedId = created?.id;
        }
      }
      setDialogOpen(false);
      setEditingPayment(null);
      setTenantHistoryById((prev) => {
        if (!pay.tenantId) return prev;
        const next = { ...prev };
        delete next[pay.tenantId];
        return next;
      });
      await load();
    } catch (e) {
      console.error(e);
      setSaveError(e?.message || "Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }, [editingPayment, payments, load]);

  useEffect(() => {
    setPageHeader({
      title: "Pagamentos",
      description: "Registre e consulte pagamentos de aluguel.",
      action: (
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingPayment(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingPayment(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar pagamento
            </Button>
          </DialogTrigger>
          <DialogContentWithClose
            title={editingPayment ? "Editar pagamento" : "Registrar pagamento"}
            onClose={() => { setDialogOpen(false); setEditingPayment(null); setSaveError(null); }}
          >
            {saveError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {saveError}
              </p>
            )}
            <PaymentForm
              payment={editingPayment}
              tenants={tenants}
              properties={properties}
              onSave={handleSave}
              onCancel={() => { setDialogOpen(false); setEditingPayment(null); setSaveError(null); }}
              saving={saving}
            />
          </DialogContentWithClose>
        </Dialog>
      ),
    });
    return () => setPageHeader({ title: null, description: null, action: null });
  }, [setPageHeader, dialogOpen, editingPayment, saveError, tenants, saving, handleSave]);

  const byTenant = Object.fromEntries(tenants.map((t) => [t.id, t]));
  const kitnets = [...new Set(tenants.map((t) => t.kitnetNumber).filter(Boolean))].sort();
  const propertyOptions = useMemo(() => {
    const byProperty = Object.fromEntries(
      (properties || []).map((prop) => [String(prop.id), prop.name || `Imóvel ${prop.id}`])
    );
    const tenantPropertyIds = [
      ...new Set(
        (tenants || [])
          .map((tenant) => {
            const propId = tenant?.propertyId ?? tenant?.property_id;
            return propId != null && propId !== "" ? String(propId) : null;
          })
          .filter(Boolean)
      ),
    ];

    return tenantPropertyIds
      .map((id) => ({
        id,
        name: byProperty[id] || `Imóvel ${id}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [properties, tenants]);

  const getValorDevido = (p) => Number(p.expectedAmount) || Number(p.amount) || 0;

  /** Status para listagem/expandido: usa valor devido do inquilino para que parciais fiquem em Pendentes, parciais e atrasados. */
  const getStatusPagamentos = (p) => {
    const valorDevido = getValorDevido(p);
    const valorPago = Number(p.amount) || 0;
    const today = new Date().toISOString().split("T")[0];
    if (valorPago >= valorDevido && valorDevido > 0) return "pago";
    if (valorPago > 0 && valorPago < valorDevido) return "pendente";
    if (valorPago === 0) return (p.dueDate || "") < today ? "atrasado" : "pendente";
    return "pendente";
  };

  /** Status na tabela expandida: apenas valorPago vs valorDevido (sem datas). */
  const getStatusExpandido = (valorDevido, valorPago) => {
    const vD = Number(valorDevido) || 0;
    const vP = Number(valorPago) || 0;
    if (vP === vD) return "Pago";
    if (vP === 0) return "Atrasado";
    if (vP > 0 && vP < vD) return "Pendente";
    return "Pendente";
  };

  const paymentsWithStatus = useMemo(() => {
    const by = Object.fromEntries(tenants.map((t) => [t.id, t]));
    return payments.map((p) => ({
      ...p,
      status: getStatusPagamentos(p),
      tenantName: by[p.tenantId]?.name || "-",
      kitnetNumber: by[p.tenantId]?.kitnetNumber || "-",
    }));
  }, [payments, tenants]);

  const getTenantPayments = useCallback(
    (tenantId) => {
      const tenantPayments = allPayments.filter((p) => p.tenantId === tenantId);
      return [...tenantPayments]
        .map((payment) => ({
          ...payment,
          status: getStatusPagamentos(payment),
          tenantName: byTenant[payment.tenantId]?.name || "-",
          kitnetNumber: byTenant[payment.tenantId]?.kitnetNumber || "-",
        }))
        .sort((a, b) => {
          const yearA = Number(a.year);
          const yearB = Number(b.year);
          const monthA = Number(a.month);
          const monthB = Number(b.month);
          if (yearA !== yearB) return yearB - yearA;
          if (monthA !== monthB) return monthB - monthA;
          return (b.dueDate || "").localeCompare(a.dueDate || "");
        });
    },
    [byTenant, allPayments]
  );

  let filtered = payments.map((p) => ({
    ...p,
    status: getStatusPagamentos(p),
    tenantName: byTenant[p.tenantId]?.name || "-",
    kitnetNumber: byTenant[p.tenantId]?.kitnetNumber || "-",
  }));

  if (reportMonth != null) filtered = filtered.filter((p) => Number(p.month) === Number(reportMonth));
  if (reportYear != null) filtered = filtered.filter((p) => Number(p.year) === Number(reportYear));
  if (filterPropertyId && filterPropertyId !== "__all__") {
    filtered = filtered.filter((p) => {
      const tenant = byTenant[p.tenantId];
      const tenantPropertyId = tenant?.propertyId ?? tenant?.property_id;
      return String(tenantPropertyId ?? "") === String(filterPropertyId);
    });
  }
  if (filterKitnet && filterKitnet !== "__all__") {
    filtered = filtered.filter((p) => p.kitnetNumber === filterKitnet);
  }
  if (filterTenantId) {
    filtered = filtered.filter((p) => p.tenantId === filterTenantId);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.tenantName?.toLowerCase().includes(q) ||
        p.kitnetNumber?.toString().includes(q)
    );
  }

  filtered = [...filtered].sort((a, b) => {
    const yearA = Number(a.year);
    const yearB = Number(b.year);
    const monthA = Number(a.month);
    const monthB = Number(b.month);
    if (yearA !== yearB) return yearB - yearA;
    if (monthA !== monthB) return monthB - monthA;
    return (b.dueDate || "").localeCompare(a.dueDate || "");
  });

  const groupedByProperty = useMemo(() => {
    const byProperty = Object.fromEntries(
      (properties || []).map((prop) => [String(prop.id), prop.name || `Imóvel ${prop.id}`])
    );

    // openCount usa todos os pagamentos (todos os períodos) para refletir meses em atraso históricos
    const today = new Date().toISOString().split("T")[0];
    const openCountByTenant = {};
    allPayments.forEach((p) => {
      const valorDevido = Number(p.expectedAmount) || Number(p.amount) || 0;
      const valorPago = Number(p.amount) || 0;
      let st;
      if (valorPago >= valorDevido && valorDevido > 0) st = "pago";
      else if (valorPago === 0) st = (p.dueDate || "") < today ? "atrasado" : "pendente";
      else st = "pendente";
      if (st === "atrasado" || st === "pendente") {
        openCountByTenant[p.tenantId] = (openCountByTenant[p.tenantId] || 0) + 1;
      }
    });

    const groups = {};
    for (const payment of filtered) {
      const tenant = byTenant[payment.tenantId];
      const propertyId = String(tenant?.propertyId ?? tenant?.property_id ?? "");
      const key = propertyId || "__sem_imovel__";
      if (!groups[key]) {
        groups[key] = {
          key,
          propertyId: propertyId || null,
          propertyName: propertyId ? (byProperty[propertyId] || `Imóvel ${propertyId}`) : "Sem imóvel vinculado",
          byTenant: {},
        };
      }
      if (!groups[key].byTenant[payment.tenantId]) {
        groups[key].byTenant[payment.tenantId] = {
          tenantId: payment.tenantId,
          tenantName: payment.tenantName,
          kitnetNumber: payment.kitnetNumber,
          payments: [],
        };
      }
      groups[key].byTenant[payment.tenantId].payments.push(payment);
    }

    return Object.values(groups).sort((a, b) => {
      if (a.key === "__sem_imovel__") return 1;
      if (b.key === "__sem_imovel__") return -1;
      return a.propertyName.localeCompare(b.propertyName, "pt-BR");
    }).map((group) => ({
      ...group,
      items: Object.values(group.byTenant)
        .map((tenantGroup) => {
          const payments = [...tenantGroup.payments].sort((a, b) => {
            const yearA = Number(a.year);
            const yearB = Number(b.year);
            const monthA = Number(a.month);
            const monthB = Number(b.month);
            if (yearA !== yearB) return yearB - yearA;
            if (monthA !== monthB) return monthB - monthA;
            return (b.dueDate || "").localeCompare(a.dueDate || "");
          });
          const latestPayment = payments[0] || null;
          const overdueCount = payments.filter((p) => p.status === "atrasado").length;
          const pendingCount = payments.filter((p) => p.status === "pendente").length;
          const summaryStatus =
            overdueCount > 0 ? "atrasado" : pendingCount > 0 ? "pendente" : "pago";
          return {
            tenantId: tenantGroup.tenantId,
            tenantName: tenantGroup.tenantName,
            kitnetNumber: tenantGroup.kitnetNumber,
            payments,
            totalPeriods: payments.length,
            openCount: openCountByTenant[tenantGroup.tenantId] || 0,
            latestPayment,
            summaryStatus,
          };
        })
        .sort((a, b) => a.tenantName.localeCompare(b.tenantName, "pt-BR")),
    }));
  }, [filtered, allPayments, properties, byTenant]);

  const yearOptions = useMemo(() => {
    const years = (payments || [])
      .map((p) => Number(p.year))
      .filter((y) => !isNaN(y));
    const cy = new Date().getFullYear();
    let min = years.length ? Math.min(...years) : cy - 1;
    let max = years.length ? Math.max(...years) : cy + 1;

    min = Math.min(min, cy - 6);
    max = Math.max(max, cy + 1);

    // Evita select gigante
    const maxSpan = 20;
    if (max - min > maxSpan) {
      max = min + maxSpan;
    }

    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [payments]);

  const analyticsData = useMemo(() => {
    const byTenant = Object.fromEntries(tenants.map((t) => [t.id, t]));
    const getValorDevido = (p) => Number(p.expectedAmount) || Number(p.amount) || 0;
    const getStatus = (p) => {
      const valorDevido = getValorDevido(p);
      const valorPago = Number(p.amount) || 0;
      const today = new Date().toISOString().split("T")[0];
      if (valorPago >= valorDevido && valorDevido > 0) return "pago";
      if (valorPago > 0 && valorPago < valorDevido) return "pendente";
      if (valorPago === 0) return (p.dueDate || "") < today ? "atrasado" : "pendente";
      return "pendente";
    };

    const rows = filtered.map((p) => {
      const valorDevido = getValorDevido(p);
      const valorPago = Number(p.amount) || 0;
      const pendente = Math.max(0, valorDevido - valorPago);
      const status = getStatus(p);
      return {
        ...p,
        valorDevido,
        valorPago,
        pendente,
        status,
        tenantName: byTenant[p.tenantId]?.name ?? "-",
        kitnetNumber: byTenant[p.tenantId]?.kitnetNumber ?? "-",
      };
    });

    const totalPagamentos = rows.length;
    const totalRecebido = rows.reduce((s, r) => s + r.valorPago, 0);
    const receitaPrevista = rows.reduce((s, r) => s + r.valorDevido, 0);
    const totalPendente = rows
      .filter((r) => r.status === "pendente")
      .reduce((s, r) => s + r.pendente, 0);
    const totalAtrasado = rows
      .filter((r) => r.status === "atrasado")
      .reduce((s, r) => s + r.pendente, 0);
    const countPago = rows.filter((r) => r.status === "pago").length;
    const taxaAdimplencia =
      totalPagamentos > 0 ? (countPago / totalPagamentos) * 100 : 0;

    const statusDistribution = [
      {
        name: "Pago",
        value: rows.filter((r) => r.status === "pago").reduce((s, r) => s + r.valorPago, 0),
        count: countPago,
      },
      {
        name: "Pendente",
        value: totalPendente,
        count: rows.filter((r) => r.status === "pendente").length,
      },
      {
        name: "Atrasado",
        value: totalAtrasado,
        count: rows.filter((r) => r.status === "atrasado").length,
      },
    ].filter((d) => d.value > 0 || d.count > 0);

    const byPeriod = {};
    rows.forEach((r) => {
      const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
      if (!byPeriod[key]) byPeriod[key] = { previsto: 0, recebido: 0 };
      byPeriod[key].previsto += r.valorDevido;
      byPeriod[key].recebido += r.valorPago;
    });
    const timelineData = Object.entries(byPeriod).map(([periodKey, v]) => {
      const [y, m] = periodKey.split("-").map(Number);
      const shortMonth = (getMonthName(m) || "").slice(0, 3);
      return {
        periodKey,
        label: `${shortMonth}/${String(y).slice(2)}`,
        previsto: v.previsto,
        recebido: v.recebido,
      };
    });

    const valorAberto = totalPendente + totalAtrasado;
    // top5 calculado sobre TODOS os pagamentos (independente do mês selecionado)
    const allRows = allPayments.map((p) => {
      const valorDevido = getValorDevido(p);
      const valorPago = Number(p.amount) || 0;
      const pendente = Math.max(0, valorDevido - valorPago);
      return {
        ...p,
        valorDevido,
        valorPago,
        pendente,
        tenantName: byTenant[p.tenantId]?.name ?? "-",
        kitnetNumber: byTenant[p.tenantId]?.kitnetNumber ?? "-",
      };
    });
    const byTenantDebtAll = {};
    allRows.forEach((r) => {
      if (r.pendente <= 0) return;
      const id = r.tenantId;
      if (!byTenantDebtAll[id]) {
        byTenantDebtAll[id] = {
          tenantId: id,
          tenantName: r.tenantName,
          kitnetNumber: r.kitnetNumber,
          totalPendente: 0,
          parcelasEmAberto: 0,
        };
      }
      byTenantDebtAll[id].totalPendente += r.pendente;
      byTenantDebtAll[id].parcelasEmAberto += 1;
    });
    const top5 = Object.values(byTenantDebtAll)
      .sort((a, b) => b.totalPendente - a.totalPendente)
      .slice(0, 5);

    return {
      totalPagamentos,
      totalRecebido,
      receitaPrevista,
      totalPendente,
      totalAtrasado,
      taxaAdimplencia,
      statusDistribution,
      timelineData,
      receitaRecebida: totalRecebido,
      valorAberto,
      top5,
    };
  }, [
    filtered,
    allPayments,
    tenants,
    condominiumByProperty,
    reportMonth,
    reportYear,
    filterKitnet,
    filterTenantId,
    search,
  ]);

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
                Pagamentos por período
              </div>
              <h1 className="period-hero-title bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
                {periodLabel}
              </h1>
              <p className="period-hero-text text-sm leading-relaxed sm:text-base">
                Indicadores, status e gráficos abaixo refletem exclusivamente{" "}
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
          <CardTitle>Listagem</CardTitle>
          <CardDescription>Filtros e busca</CardDescription>
          <div className="mb-20 mt-3 flex items-center gap-3 rounded-lg border-2 border-amber-500/40 bg-amber-500/10 px-4 py-3 pb-4">
            <MousePointerClick className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Clique na linha do inquilino para abrir todos os pagamentos dele.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por inquilino ou kitnet..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterKitnet || "__all__"} onValueChange={setFilterKitnet}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Todas kitnets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {kitnets.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPropertyId || "__all__"} onValueChange={setFilterPropertyId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Todos imóveis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos imóveis</SelectItem>
                {propertyOptions.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!loading && loadError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <p className="text-center text-muted-foreground">{loadError}</p>
              <Button variant="outline" onClick={() => load()}>
                Tentar novamente
              </Button>
            </div>
          ) : loading ? (
            <p className="py-8 text-center text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhum pagamento encontrado.</p>
          ) : (
          <div className="space-y-8">
          {groupedByProperty.map((group) => (
            <div key={group.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold tracking-tight">{group.propertyName}</h3>
                <span className="text-xs text-muted-foreground">{group.items.length} inquilino(s)</span>
              </div>
              <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inquilino</TableHead>
                <TableHead>Kitnet</TableHead>
                <TableHead>Periodos</TableHead>
                <TableHead>Em aberto</TableHead>
                <TableHead>Ultimo periodo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {group.items.map((tenantRow) => {
                  const isExpanded = expandedTenantId === tenantRow.tenantId;
                  const tenantPayments = isExpanded ? getTenantPayments(tenantRow.tenantId) : [];
                  const badgeClass =
                    tenantRow.summaryStatus === "pago"
                      ? "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300 border-emerald-500/30"
                      : tenantRow.summaryStatus === "pendente"
                        ? "bg-amber-500/20 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300 border-amber-500/30"
                        : "bg-red-500/20 text-red-600 dark:bg-red-500/25 dark:text-red-300 border-red-500/30";
                  const latestPeriod = tenantRow.latestPayment
                    ? `${getMonthName(tenantRow.latestPayment.month)} ${tenantRow.latestPayment.year}`
                    : "-";
                  return (
                    <Fragment key={tenantRow.tenantId}>
                      <TableRow
                        onClick={() => {
                          setExpandedTenantId(expandedTenantId === tenantRow.tenantId ? null : tenantRow.tenantId);
                        }}
                        className="cursor-pointer hover:bg-muted/50"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setExpandedTenantId(expandedTenantId === tenantRow.tenantId ? null : tenantRow.tenantId);
                          }
                        }}
                      >
                        <TableCell className="font-medium">{tenantRow.tenantName}</TableCell>
                        <TableCell>{tenantRow.kitnetNumber}</TableCell>
                        <TableCell>{tenantRow.totalPeriods}</TableCell>
                        <TableCell>
                          {tenantRow.openCount > 0 ? (
                            <span className="font-semibold text-red-600 dark:text-red-400">{tenantRow.openCount} mes(es)</span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">Nenhum</span>
                          )}
                        </TableCell>
                        <TableCell>{latestPeriod}</TableCell>
                        <TableCell>
                          <Badge className={badgeClass}>
                            {tenantRow.summaryStatus === "pago"
                              ? "Pago"
                              : tenantRow.summaryStatus === "pendente"
                                ? "Pendente"
                                : "Atrasado"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30 p-0 align-top">
                            <div className="space-y-3 p-4">
                              {tenantPayments.length > 0 && (
                                <div>
                                  <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                                    Historico completo de pagamentos
                                  </h4>
                                  <div className="overflow-x-auto rounded-lg border border-border/50">
                                  <table className="w-full min-w-[720px] table-auto caption-bottom text-sm border-collapse">
                                    <thead>
                                      <tr className="bg-muted/40">
                                        <th className="h-10 px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Mês</th>
                                        <th className="h-10 px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Ano</th>
                                        <th className="h-10 px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Valor devido</th>
                                        <th className="h-10 px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Valor pago</th>
                                        <th className="h-10 px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Pendente</th>
                                        <th className="h-10 px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Vencimento</th>
                                        <th className="h-10 px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Status</th>
                                        <th className="h-10 px-3 py-2 text-center text-xs font-medium text-muted-foreground whitespace-nowrap w-10">Ações</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {tenantPayments.map((pay) => {
                                        const valorDevido = Number(pay.expectedAmount) || Number(pay.amount) || 0;
                                        const valorPago = Number(pay.amount) || 0;
                                        const pend = Math.max(0, valorDevido - valorPago);
                                        const statusExpandido = getStatusExpandido(valorDevido, valorPago);
                                        const badgeClass =
                                          statusExpandido === "Pago"
                                            ? "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300 border-emerald-500/30"
                                            : statusExpandido === "Pendente"
                                            ? "bg-amber-500/20 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300 border-amber-500/30"
                                            : "bg-red-500/20 text-red-600 dark:bg-red-500/25 dark:text-red-300 border-red-500/30";
                                        return (
                                          <tr key={pay.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                                            <td className="px-3 py-2.5 align-middle">{getMonthName(pay.month)}</td>
                                            <td className="px-3 py-2.5 align-middle">{pay.year}</td>
                                            <td className="px-3 py-2.5 align-middle text-muted-foreground">{formatCurrency(valorDevido)}</td>
                                            <td className="px-3 py-2.5 align-middle font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(valorPago)}</td>
                                            <td className={cn("px-3 py-2.5 align-middle", pend > 0 ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                                              {pend > 0 ? formatCurrency(pend) : "-"}
                                            </td>
                                            <td className="px-3 py-2.5 align-middle whitespace-nowrap">{formatDate(pay.dueDate)}</td>
                                            <td className="px-3 py-2.5 align-middle">
                                              <Badge className={badgeClass}>
                                                {statusExpandido}
                                              </Badge>
                                            </td>
                                            <td className="px-3 py-2.5 align-middle text-center">
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => { e.stopPropagation(); setEditingPayment(pay); setDialogOpen(true); }}
                                                title="Editar"
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
                              )}
                              {tenantPayments.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                  Nenhum outro pagamento registrado para este inquilino.
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
            </TableBody>
          </Table>
            </div>
          ))}
          </div>
          )}
        </CardContent>
      </Card>
        }
        dashboardContent={!loading && !loadError ? (
        <section className="space-y-8 pt-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Análise Financeira dos Pagamentos
          </h2>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Indicadores principais
            </h3>
            <PaymentsAnalyticsStats
              totalPagamentos={analyticsData.totalPagamentos}
              totalRecebido={analyticsData.totalRecebido}
              totalPendente={analyticsData.totalPendente}
              totalAtrasado={analyticsData.totalAtrasado}
              receitaPrevista={analyticsData.receitaPrevista}
              taxaAdimplencia={analyticsData.taxaAdimplencia}
              formatCurrency={formatCurrency}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
              <CardHeader className={cn("border-b border-border/50 pb-2", accentCardClasses.revenue)}>
                <CardTitle className="text-base font-semibold">Distribuição por status</CardTitle>
                <CardDescription>
                  Pago, Pendente e Atrasado — valor e quantidade
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentsStatusDistribution
                  data={analyticsData.statusDistribution}
                  formatCurrency={formatCurrency}
                />
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
              <CardHeader className={cn("border-b border-border/50 pb-2", accentCardClasses.revenue)}>
                <CardTitle className="text-base font-semibold">Receita ao longo do tempo</CardTitle>
                <CardDescription>
                  Previsto vs Recebido por mês/ano
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentsRevenueTimeline
                  data={analyticsData.timelineData}
                  formatCurrency={formatCurrency}
                />
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
            <CardHeader className={cn("border-b border-border/50 pb-2", accentCardClasses.revenue)}>
              <CardTitle className="text-base font-semibold">Progresso de recebimento</CardTitle>
              <CardDescription>
                Receita prevista, recebida e valor em aberto
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <PaymentsRevenueProgress
                receitaPrevista={analyticsData.receitaPrevista}
                receitaRecebida={analyticsData.receitaRecebida}
                valorAberto={analyticsData.valorAberto}
                formatCurrency={formatCurrency}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
            <CardHeader className={cn("border-b border-border/50 pb-2", accentCardClasses.warning)}>
              <CardTitle className="text-base font-semibold">Maiores dívidas atuais</CardTitle>
              <CardDescription>
                Pessoas que mais devem — Top 5 inquilinos com maior valor em débito
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <PaymentsTopDebts
                items={analyticsData.top5}
                formatCurrency={formatCurrency}
              />
            </CardContent>
          </Card>
        </section>
      ) : null}
        insightsContent={!loading && !loadError ? (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Insights
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <InsightCard icon={Wallet} title="Receita" accent="revenue">
              Total recebido de <strong>{formatCurrency(analyticsData.totalRecebido)}</strong> em pagamentos.
              Receita prevista no período: <strong>{formatCurrency(analyticsData.receitaPrevista)}</strong>.
            </InsightCard>
            <InsightCard icon={BarChart3} title="Adimplência" accent="revenue">
              Taxa de adimplência atual: <strong>{analyticsData.taxaAdimplencia.toFixed(1)}%</strong>.
              {analyticsData.totalPagamentos > 0 && (
                <> {analyticsData.totalPagamentos} pagamento(s) registrado(s).</>
              )}
            </InsightCard>
            <InsightCard icon={TrendingUp} title="Valores em aberto" accent="warning">
              Valor total pendente: <strong>{formatCurrency(analyticsData.totalPendente + analyticsData.totalAtrasado)}</strong>.
              {analyticsData.top5?.length > 0 && (
                <> Os maiores débitos estão entre os {analyticsData.top5.length} inquilinos listados no dashboard.</>
              )}
            </InsightCard>
          </div>
        </section>
      ) : null}
        extraTabs={[{
          value: "sacar",
          label: "Sacar",
          content: (
            <WithdrawalSection />
          ),
        }]}
      />

    </div>
  );
}

export default function PagamentosPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-8 text-muted-foreground">Carregando...</div>}>
      <PagamentosContent />
    </Suspense>
  );
}
