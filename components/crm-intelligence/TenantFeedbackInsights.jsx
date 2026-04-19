"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { accentCardClasses, dataColors } from "@/lib/chartColors";

const CATEGORY_LABELS = {
  Infraestrutura: "Infraestrutura",
  Internet: "Internet",
  Segurança: "Segurança",
  Limpeza: "Limpeza",
  Manutenção: "Manutenção",
  outro: "Outro",
  Outro: "Outro",
};

export function TenantFeedbackInsights({ feedbackByCategory = {} }) {
  const total = Object.values(feedbackByCategory).reduce((a, b) => a + b, 0);
  const data = Object.entries(feedbackByCategory)
    .map(([cat, count]) => ({
      name: CATEGORY_LABELS[cat] || cat,
      count,
      percent: total ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
      <CardHeader className={cn("border-b border-border/50", accentCardClasses.info)}>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <CardTitle className="text-base font-semibold">Feedback e melhorias</CardTitle>
        </div>
        <CardDescription>
          Sugestões dos moradores por categoria. Use para priorizar melhorias.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum feedback registrado ainda.</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {data.slice(0, 5).map((d) => (
                <span
                  key={d.name}
                  className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                >
                  {d.percent}% – {d.name}
                </span>
              ))}
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <defs>
                    <linearGradient id="feedback-bar-fill" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={dataColors.info} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={dataColors.info} stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value, name, props) => [`${props.payload?.percent ?? 0}% (${value} menções)`, props.payload?.name ?? ""]} />
                  <Bar
                    dataKey="count"
                    fill="url(#feedback-bar-fill)"
                    stroke={dataColors.info}
                    strokeWidth={1.5}
                    radius={[0, 4, 4, 0]}
                    name="Menções"
                    activeBar={{ fill: "url(#feedback-bar-fill)", stroke: dataColors.info, strokeWidth: 1.5 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
