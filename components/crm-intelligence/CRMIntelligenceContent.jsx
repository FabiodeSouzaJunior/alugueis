"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { accentCardClasses } from "@/lib/chartColors";
import { fetchCrmIntelligenceOverview, fetchTenants, fetchTenantSatisfaction, fetchTenantFeedback, fetchTenantInteractions, fetchPayments } from "@/lib/api";
import { CRMIntelligenceDashboard } from "./CRMIntelligenceDashboard";
import { TenantSatisfactionAnalytics } from "./TenantSatisfactionAnalytics";
import { DemandAndVacancyCharts } from "./DemandAndVacancyCharts";
import { RentPriceIntelligence } from "./RentPriceIntelligence";
import { TenantFeedbackInsights } from "./TenantFeedbackInsights";
import { ExitReasonsChart } from "./ExitReasonsChart";
import { TenantRetentionMetrics } from "./TenantRetentionMetrics";
import { TenantProfilePanel } from "./TenantProfilePanel";
import { User } from "lucide-react";

export function CRMIntelligenceContent() {
  const [overview, setOverview] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profileTenant, setProfileTenant] = useState(null);
  const [profileExtra, setProfileExtra] = useState({ satisfaction: [], feedback: [], interactions: [] });

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [overviewRes, tenantsRes, paymentsRes] = await Promise.all([
        fetchCrmIntelligenceOverview(),
        fetchTenants(),
        fetchPayments(),
      ]);
      setOverview(overviewRes || null);
      setTenants(Array.isArray(tenantsRes) ? tenantsRes : []);
      setPayments(Array.isArray(paymentsRes) ? paymentsRes : []);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openProfile = useCallback(async (tenant) => {
    if (!tenant?.id) return;
    setProfileTenant(tenant);
    try {
      const [sat, feedback, interactions] = await Promise.all([
        fetchTenantSatisfaction(tenant.id),
        fetchTenantFeedback(tenant.id),
        fetchTenantInteractions(tenant.id),
      ]);
      setProfileExtra({
        satisfaction: Array.isArray(sat) ? sat : [],
        feedback: Array.isArray(feedback) ? feedback : [],
        interactions: Array.isArray(interactions) ? interactions : [],
      });
    } catch (e) {
      setProfileExtra({ satisfaction: [], feedback: [], interactions: [] });
    }
  }, []);

  const tenantPayments = profileTenant ? payments.filter((p) => p.tenantId === profileTenant.id) : [];

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/10">
        <CardContent className="py-4">
          <p className="text-sm text-destructive">{error}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Verifique se as tabelas do CRM Inteligência foram criadas (scripts/migrations/crm-intelligence-tables.sql).
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-muted/30" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-border bg-muted/20" />
      </div>
    );
  }

  const satisfactionByTenant = overview?.satisfactionByTenant && typeof overview.satisfactionByTenant === "object"
    ? overview.satisfactionByTenant
    : {};

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
          Dashboard inteligente de inquilinos
        </h2>
        <CRMIntelligenceDashboard
          activeTenants={overview?.activeTenants ?? 0}
          occupied={overview?.occupied ?? 0}
          occupancyRate={overview?.occupancyRate ?? 0}
          avgTenureMonths={overview?.avgTenureMonths ?? 0}
          exitsThisMonth={overview?.exitsThisMonth ?? 0}
        />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
          Satisfação dos inquilinos
        </h2>
        <TenantSatisfactionAnalytics
          avgSatisfaction={overview?.avgSatisfaction}
          satisfactionOverTime={overview?.satisfactionOverTime ?? []}
          satisfactionByTenant={satisfactionByTenant}
        />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
          Análise de demanda e vacância
        </h2>
        <DemandAndVacancyCharts
          entriesByMonth={overview?.entriesByMonth ?? []}
          exitsByMonth={overview?.exitsByMonth ?? []}
          totalKitnets={overview?.totalKitnets ?? 12}
        />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
          Inteligência de preço de aluguel
        </h2>
        <RentPriceIntelligence
          occupancyRate={overview?.occupancyRate ?? 0}
          entriesByMonth={overview?.entriesByMonth ?? []}
          exitsByMonth={overview?.exitsByMonth ?? []}
          empty={overview?.empty ?? 0}
          totalKitnets={overview?.totalKitnets ?? 12}
        />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
          Perfil do inquilino
        </h2>
        <Card className="rounded-xl border border-border shadow-sm">
          <CardHeader className={cn("border-b border-border/50", accentCardClasses.info)}>
            <CardTitle className="text-base font-semibold">Lista de inquilinos</CardTitle>
            <CardDescription>Clique para abrir perfil completo, histórico e linha do tempo</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {tenants.filter((t) => t.status === "ativo").map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openProfile(t)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-left text-sm transition hover:bg-muted/50"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{t.name}</span>
                  <span className="text-muted-foreground">Kitnet {t.kitnetNumber}</span>
                </button>
              ))}
              {tenants.filter((t) => t.status === "ativo").length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum inquilino ativo.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
          Feedback e melhorias
        </h2>
        <TenantFeedbackInsights feedbackByCategory={overview?.feedbackByCategory ?? {}} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
          Relatório de saída do inquilino
        </h2>
        <ExitReasonsChart exitReasonsCount={overview?.exitReasonsCount ?? {}} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
          Análise de retenção
        </h2>
        <TenantRetentionMetrics
          avgTenureMonths={overview?.avgTenureMonths ?? 0}
          renewalRate={overview?.renewalRate ?? 0}
          entriesByMonth={overview?.entriesByMonth ?? []}
          exitsByMonth={overview?.exitsByMonth ?? []}
          activeTenants={overview?.activeTenants ?? 0}
        />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
          Coleta de feedback dos moradores
        </h2>
        <Card className={cn("rounded-xl border border-border shadow-sm", accentCardClasses.info)}>
          <CardContent className="p-6">
            <p className="mb-4 text-sm text-muted-foreground">
              Os dados de satisfação e feedback dos moradores são coletados através da página de avaliação. Envie o link abaixo aos moradores para que possam avaliar a experiência na kitnet.
            </p>
            <a
              href="/avaliacao"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Abrir página de avaliação
            </a>
          </CardContent>
        </Card>
      </section>

      {profileTenant && (
        <TenantProfilePanel
          tenant={profileTenant}
          payments={tenantPayments}
          satisfactionList={profileExtra.satisfaction}
          feedbackList={profileExtra.feedback}
          interactionsList={profileExtra.interactions}
          onClose={() => {
            setProfileTenant(null);
            setProfileExtra({ satisfaction: [], feedback: [], interactions: [] });
          }}
          onRefresh={() => {
            load();
            setProfileTenant(null);
          }}
        />
      )}
    </div>
  );
}
