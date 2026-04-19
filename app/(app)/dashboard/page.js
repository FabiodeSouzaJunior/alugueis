"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Home,
  UserCheck,
  TrendingUp,
  Banknote,
  AlertTriangle,
  PiggyBank,
  Receipt,
  Building2,
  Bell,
  HardHat,
  Wrench,
  Star,
} from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/utils";
import { fetchDashboardOverview } from "@/lib/api";
import { useAppFilters } from "@/context/app-filters";
import { StatCard } from "@/components/cards/StatCard";
import { ChartCard } from "@/components/cards/ChartCard";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { DashboardAlertsBanner } from "@/components/dashboard/DashboardAlertsBanner";
import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline";
import { DashboardTopDebtors } from "@/components/dashboard/DashboardTopDebtors";
import { ProjectProgressList } from "@/components/dashboard/ProjectProgressList";
import { SkeletonPage } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { accentCardClasses } from "@/lib/chartColors";

const RevenueExpenseLineChart = dynamic(
  () => import("@/components/charts/RevenueExpenseLineChart").then((mod) => mod.RevenueExpenseLineChart),
  { ssr: false }
);
const PaymentStatusPieChart = dynamic(
  () => import("@/components/charts/PaymentStatusPieChart").then((mod) => mod.PaymentStatusPieChart),
  { ssr: false }
);
const OccupancyDonutChart = dynamic(
  () => import("@/components/charts/OccupancyDonutChart").then((mod) => mod.OccupancyDonutChart),
  { ssr: false }
);
const CumulativeRevenueChart = dynamic(
  () => import("@/components/charts/CumulativeRevenueChart").then((mod) => mod.CumulativeRevenueChart),
  { ssr: false }
);
const CostDistributionChart = dynamic(
  () => import("@/components/dashboard/CostDistributionChart").then((mod) => mod.CostDistributionChart),
  { ssr: false }
);
const InadimplenciaTimeline = dynamic(
  () => import("@/components/inadimplencia/InadimplenciaTimeline").then((mod) => mod.InadimplenciaTimeline),
  { ssr: false }
);
const PaymentsRevenueProgress = dynamic(
  () => import("@/components/payments-analytics/PaymentsRevenueProgress").then((mod) => mod.PaymentsRevenueProgress),
  { ssr: false }
);

export default function DashboardPage() {
  const { month, year } = useAppFilters();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetchDashboardOverview({ month, year });
        if (!active) return;
        setOverview(response);
      } catch (error) {
        if (!active) return;
        console.error(error);
        setLoadError(error?.message || "Erro ao carregar o dashboard.");
        setOverview(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, [month, year]);

  const stats = overview?.stats ?? {};
  const financial = overview?.financial ?? {};
  const works = overview?.works ?? {};
  const occupancy = overview?.occupancy ?? {};
  const notifications = overview?.notifications ?? {};
  const crm = overview?.crm ?? {};

  const cards = useMemo(
    () => [
      {
        title: "Total de kitnets",
        value: String(stats.totalKitnets ?? 0),
        description: "Capacidade cadastrada",
        icon: Home,
        accent: "property",
      },
      {
        title: "Kitnets ocupadas",
        value: String(stats.occupied ?? 0),
        description: `${stats.occupancyRate ?? 0}% de ocupação`,
        icon: UserCheck,
        accent: "property",
      },
      {
        title: "Receita recebida",
        value: formatCurrency(stats.receivedRevenue ?? 0),
        description: `Ano ${year}`,
        icon: Banknote,
        accent: "revenue",
      },
      {
        title: "Lucro",
        value: formatCurrency(stats.profit ?? 0),
        description: `Despesas: ${formatCurrency(stats.totalExpenses ?? 0)}`,
        icon: TrendingUp,
        accent: "revenue",
      },
      {
        title: "Total em atraso",
        value: formatCurrency(stats.overdueAmount ?? 0),
        description: "Débitos vencidos",
        icon: AlertTriangle,
        accent: "warning",
      },
      {
        title: "Total pendente",
        value: formatCurrency(stats.totalPending ?? 0),
        description: "Em aberto no fluxo financeiro",
        icon: PiggyBank,
        accent: "warning",
      },
      {
        title: "Obras ativas",
        value: String(stats.activeObras ?? 0),
        description: `${stats.completedObras ?? 0} concluídas`,
        icon: HardHat,
        accent: "construction",
      },
      {
        title: "Manutenção",
        value: String(stats.activeMaintenance ?? 0),
        description: "Chamados em acompanhamento",
        icon: Wrench,
        accent: "info",
      },
    ],
    [stats.activeMaintenance, stats.activeObras, stats.completedObras, stats.occupancyRate, stats.occupied, stats.overdueAmount, stats.profit, stats.receivedRevenue, stats.totalExpenses, stats.totalKitnets, stats.totalPending, year]
  );

  if (loading) {
    return <SkeletonPage />;
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Consolidado de {month}/{year}
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Dashboard Geral
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Visão completa do financeiro, ocupação, CRM e operação com carregamento otimizado.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/pagamentos" prefetch>
                Pagamentos
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/inadimplentes" prefetch>
                Inadimplentes
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/notifications" prefetch>
                Notificações
              </Link>
            </Button>
          </div>
        </div>
        <DashboardAlertsBanner alerts={overview?.alerts || []} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Receita x despesas"
          description={`Comparação mensal de ${year}`}
          accent="revenue"
        >
          <RevenueExpenseLineChart data={financial.revenueExpenseLine || []} />
        </ChartCard>

        <ChartCard
          title="Status dos pagamentos"
          description="Pago, pendente e atrasado"
          accent="warning"
        >
          <PaymentStatusPieChart data={financial.statusDistribution || []} />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Ocupação"
          description="Ocupadas x vazias"
          accent="property"
        >
          <OccupancyDonutChart occupied={occupancy.occupied ?? 0} empty={occupancy.empty ?? 0} />
        </ChartCard>

        <ChartCard
          title="Receita acumulada"
          description="Evolução dos recebimentos"
          accent="revenue"
        >
          <CumulativeRevenueChart data={financial.cumulativeRevenue || []} />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Progresso de recebimento"
          description="Previsto, recebido e em aberto"
          accent="revenue"
        >
          <PaymentsRevenueProgress
            receitaPrevista={financial.revenueProgress?.receitaPrevista ?? 0}
            receitaRecebida={financial.revenueProgress?.receitaRecebida ?? 0}
            valorAberto={financial.revenueProgress?.valorAberto ?? 0}
            formatCurrency={formatCurrency}
          />
        </ChartCard>

        <ChartCard
          title="Linha do tempo da inadimplência"
          description="Valores em aberto por competência"
          accent="expense"
        >
          <InadimplenciaTimeline
            data={financial.inadimplenciaTimeline || []}
            formatCurrency={formatCurrency}
          />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Top inadimplentes"
          description="Maiores débitos atuais"
          accent="warning"
        >
          <DashboardTopDebtors items={financial.topDebtors || []} formatCurrency={formatCurrency} />
        </ChartCard>

        <ChartCard
          title="Custo por categoria"
          description="Distribuição das obras"
          accent="construction"
        >
          <CostDistributionChart data={works.costDistribution || []} />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Obras"
          description="Progresso e custo consolidado"
          accent="construction"
        >
          <ProjectProgressList projects={works.projects || []} formatCurrency={formatCurrency} />
        </ChartCard>

        <ChartCard
          title="Atividade recente"
          description={`Atualizado em ${overview?.generatedAt ? formatDate(overview.generatedAt) : "-"}`}
          accent="info"
        >
          <ActivityTimeline
            items={(overview?.activity || []).slice(0, 4)}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
          />
        </ChartCard>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className={`rounded-xl border p-5 shadow-sm ${accentCardClasses.info}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Notificações
              </p>
              <p className="text-2xl font-bold text-foreground">
                {notifications.unreadCount ?? 0}
              </p>
              <p className="text-sm text-muted-foreground">não lidas no sino e na central</p>
            </div>
            <Bell className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>

        <div className={`rounded-xl border p-5 shadow-sm ${accentCardClasses.warning}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Satisfação
              </p>
              <p className="text-2xl font-bold text-foreground">
                {stats.avgSatisfaction != null ? `${Number(stats.avgSatisfaction).toFixed(1)}/5` : "-"}
              </p>
              <p className="text-sm text-muted-foreground">
                {crm.newThisMonth ?? 0} entrada(s) e {crm.exitsThisMonth ?? 0} saída(s) no período
              </p>
            </div>
            <Star className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>

        <div className={`rounded-xl border p-5 shadow-sm ${accentCardClasses.expense}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Despesas
              </p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(stats.totalExpenses ?? 0)}
              </p>
              <p className="text-sm text-muted-foreground">
                Lucro estimado: {formatCurrency(stats.profit ?? 0)}
              </p>
            </div>
            <Receipt className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </section>

      <DashboardSection title="Indicadores principais">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <StatCard
              key={card.title}
              title={card.title}
              value={card.value}
              description={card.description}
              icon={card.icon}
              accent={card.accent}
            />
          ))}
        </div>
      </DashboardSection>
    </div>
  );
}
