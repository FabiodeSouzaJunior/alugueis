"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { accentCardClasses, dataColors } from "@/lib/chartColors";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

export function TenantSatisfactionAnalytics({
  avgSatisfaction,
  satisfactionOverTime = [],
  satisfactionByTenant = {},
}) {
  const RADIAN = Math.PI / 180;
  const pieLabelVivid = ({ cx, cy, midAngle, outerRadius, name, value, fill }) => {
    const x = cx + (outerRadius + 16) * Math.cos(-midAngle * RADIAN);
    const y = cy + (outerRadius + 16) * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill={fill || "#64748b"}
        textAnchor={x >= cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
      >
        {name}: {value}
      </text>
    );
  };
  let distributionData = [1, 2, 3, 4, 5].map((star, i) => {
    const count = Object.values(satisfactionByTenant).filter(
      (s) => s?.overall === star
    ).length;
    return { name: `${star} estrela(s)`, value: count, fill: COLORS[i] };
  }).filter((d) => d.value > 0);
  if (distributionData.length === 0) {
    distributionData = [{ name: "Sem avaliações", value: 1, fill: "#64748b" }];
  }

  const overTimeData = satisfactionOverTime.filter((d) => d.average != null);

  return (
    <div className="space-y-6">
      <Card className={cn("overflow-hidden rounded-xl border border-border shadow-sm", accentCardClasses.info)}>
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-muted-foreground">
            Os dados de satisfação e feedback são coletados pela página de avaliação dos moradores. O administrador não insere avaliações manualmente.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
          <CardHeader className={cn("border-b border-border/50", accentCardClasses.revenue)}>
            <CardTitle className="text-base font-semibold">Média de satisfação</CardTitle>
            <CardDescription>Coletado pela página de avaliação dos moradores</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <span className="text-4xl font-bold tabular-nums">
                {avgSatisfaction != null ? avgSatisfaction.toFixed(1) : "–"}
              </span>
              <span className="text-muted-foreground">/ 5</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
          <CardHeader className={cn("border-b border-border/50", accentCardClasses.info)}>
            <CardTitle className="text-base font-semibold">Evolução da satisfação</CardTitle>
            <CardDescription>Média por mês</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {overTimeData.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sem dados</p>
            ) : (
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={satisfactionOverTime} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(m) => m ? String(m).slice(-2) + "/" + String(m).slice(0, 4) : ""} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="average" name="Média" stroke={dataColors.info} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
        <CardHeader className={cn("border-b border-border/50", accentCardClasses.warning)}>
          <CardTitle className="text-base font-semibold">Distribuição de avaliações</CardTitle>
          <CardDescription>Por nota geral (1 a 5)</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  nameKey="name"
                  label={pieLabelVivid}
                >
                  {distributionData.map((entry, i) => {
                  const color = entry.fill || COLORS[i % COLORS.length];
                  return (
                    <Cell
                      key={i}
                      fill={`${color}40`}
                      stroke={color}
                      strokeWidth={1.5}
                    />
                  );
                })}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
