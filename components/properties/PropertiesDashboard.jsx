"use client";

import { Building2, LayoutGrid, Users, TrendingUp } from "lucide-react";
import { StatsCard } from "@/components/reports/StatsCard";
import { ChartCard } from "@/components/cards/ChartCard";
import { AdvancedBarChart } from "@/components/charts/AdvancedBarChart";
import { dataColors } from "@/lib/chartColors";
import { formatCurrency } from "@/lib/utils";

export function PropertiesDashboard({ dashboard, loading }) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-muted/20 animate-pulse" />
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">Carregando dashboard...</p>
      </div>
    );
  }

  if (!dashboard?.stats) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum dado disponível. Cadastre imóveis na aba Tabela.
      </p>
    );
  }

  const { stats, charts } = dashboard;
  const {
    totalProperties,
    totalUnits,
    totalMoradores,
    topPropertyByRevenue,
  } = stats;

  return (
    <section className="space-y-8 pt-2">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Análise de Imóveis
      </h2>

      <div>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Indicadores principais
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total de imóveis"
            value={totalProperties}
            icon={Building2}
            accent="property"
          />
          <StatsCard
            title="Total de unidades"
            value={totalUnits}
            description="Unidades / kitnets"
            icon={LayoutGrid}
            accent="property"
          />
          <StatsCard
            title="Total de moradores"
            value={totalMoradores}
            description="Inquilinos ativos"
            icon={Users}
            accent="property"
          />
          <StatsCard
            title="Imóvel com maior receita"
            value={topPropertyByRevenue}
            description="Por pagamentos vinculados"
            icon={TrendingUp}
            accent="revenue"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Gasto em obras por imóvel"
          description="Soma de custos das obras vinculadas ao imóvel"
          accent="expense"
        >
          {charts?.obraSpendByProperty?.length > 0 ? (
            <AdvancedBarChart
              data={charts.obraSpendByProperty}
              xAxisKey="name"
              series={[{ dataKey: "total", name: "Gasto em obras", color: dataColors.expense }]}
              formatValue={formatCurrency}
              height={260}
              yAxisFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`)}
              emptyMessage="Nenhum gasto em obras"
            />
          ) : (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
              Nenhum gasto em obras (vincule obras a um imóvel).
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Arrecadação mensal (aluguéis) por imóvel"
          description="Soma do aluguel das unidades do imóvel"
          accent="revenue"
        >
          {charts?.monthlyRentByProperty?.length > 0 ? (
            <AdvancedBarChart
              data={charts.monthlyRentByProperty}
              xAxisKey="name"
              series={[{ dataKey: "total", name: "Aluguéis / mês", color: dataColors.revenue }]}
              formatValue={formatCurrency}
              height={260}
              yAxisFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`)}
              emptyMessage="Nenhuma arrecadação"
            />
          ) : (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
              Nenhum dado de aluguel (defina aluguel nas unidades).
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Tempo para quitar (meses)"
        description="Meses = gasto em obras ÷ arrecadação mensal"
        accent="warning"
      >
        {charts?.payoffMonthsByProperty?.length > 0 ? (
          <AdvancedBarChart
            data={charts.payoffMonthsByProperty.filter((x) => x.months != null)}
            xAxisKey="name"
            series={[{ dataKey: "months", name: "Meses p/ quitar", color: dataColors.warning }]}
            formatValue={(v) => `${Number(v)} meses`}
            height={280}
            yAxisFormatter={(v) => `${v}`}
            emptyMessage="Sem dados (precisa de aluguel > 0)"
          />
        ) : (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            Sem dados suficientes. Informe aluguéis e gastos em obras.
          </div>
        )}
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Valorização do imóvel"
          description="Valor estimado por imóvel"
          accent="property"
        >
          {charts?.valuation?.length > 0 ? (
            <AdvancedBarChart
              data={charts.valuation}
              xAxisKey="name"
              series={[{ dataKey: "value", name: "Valor estimado", color: dataColors.revenue }]}
              formatValue={formatCurrency}
              height={260}
              yAxisFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`)}
              emptyMessage="Nenhum valor estimado"
            />
          ) : (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
              Nenhum dado. Informe valor estimado nos imóveis.
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Receita por imóvel"
          description="Pagamentos recebidos por imóvel (inquilinos vinculados)"
          accent="revenue"
        >
          {charts?.revenueByProperty?.length > 0 ? (
            <AdvancedBarChart
              data={charts.revenueByProperty}
              xAxisKey="name"
              series={[{ dataKey: "total", name: "Receita", color: dataColors.revenue }]}
              formatValue={formatCurrency}
              height={260}
              yAxisFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`)}
              emptyMessage="Nenhuma receita"
            />
          ) : (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
              Vincule inquilinos aos imóveis para ver receita por imóvel.
            </div>
          )}
        </ChartCard>
      </div>
    </section>
  );
}
