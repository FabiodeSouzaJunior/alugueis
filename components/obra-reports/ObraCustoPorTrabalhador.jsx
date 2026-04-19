"use client";

import { cn } from "@/lib/utils";
import { User, Users, Briefcase, BarChart3, Info } from "lucide-react";

const WORKER_BAR_COLORS = [
  "bg-emerald-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-slate-500",
];

export function ObraCustoPorTrabalhador({
  workers = [],
  totalMaoDeObra = 0,
  formatCurrency,
}) {
  const total = totalMaoDeObra || 0;
  const avgPerWorker = workers.length > 0 && total > 0 ? total / workers.length : 0;
  const topWorker =
    workers.length > 0
      ? workers.reduce((max, w) => (w.totalPaid > max.totalPaid ? w : max), workers[0])
      : null;

  return (
    <div className="flex min-h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-muted/30 px-6 py-4">
        <h3 className="font-semibold text-foreground">Custo por trabalhador</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Total pago por pessoa · baseado nos lançamentos de mão de obra
        </p>
        {workers.length > 0 && total > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2">
            <Users className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {workers.length} {workers.length === 1 ? "trabalhador" : "trabalhadores"} · Total{" "}
              {formatCurrency(total)}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        {workers.length === 0 ? (
          <div className="flex flex-1 flex-col justify-center py-6">
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <User className="h-7 w-7" />
              </div>
              <p className="font-medium text-foreground">Nenhum trabalhador registrado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Os custos de mão de obra aparecem aqui quando você registra trabalhadores na obra.
              </p>
            </div>
            <div className="mt-6 rounded-lg border border-border bg-muted/30 px-4 py-4">
              <p className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                O que você verá aqui
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li>· Valor pago por cada trabalhador</li>
                <li>· Função e percentual sobre o total</li>
                <li>· Média por pessoa e maior pagamento</li>
                <li>· Total de mão de obra da obra</li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Acesse <strong className="text-foreground">Trabalhadores</strong> no menu da obra
                para cadastrar.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col space-y-5">
            {total > 0 && workers.some((w) => w.totalPaid > 0) && (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Participação de cada trabalhador no total
                </p>
                <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                  {workers.map((w, i) => {
                    const pct = total > 0 ? (w.totalPaid / total) * 100 : 0;
                    if (pct <= 0) return null;
                    return (
                      <div
                        key={`${w.name}-${w.role || ""}`}
                        className={cn(
                          "transition-all duration-500",
                          WORKER_BAR_COLORS[i % WORKER_BAR_COLORS.length]
                        )}
                        style={{ width: `${pct}%` }}
                        title={`${w.name} · ${pct.toFixed(0)}%`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {workers.map((w, i) => {
                    const pct = total > 0 ? (w.totalPaid / total) * 100 : 0;
                    if (pct <= 0) return null;
                    return (
                      <span key={`${w.name}-${w.role || ""}`}>
                        <span
                          className={cn(
                            "mr-1.5 inline-block h-2 w-2 rounded-full",
                            WORKER_BAR_COLORS[i % WORKER_BAR_COLORS.length]
                          )}
                        />
                        {w.name} {pct.toFixed(0)}%
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {(avgPerWorker > 0 || topWorker) && (
              <div className="grid grid-cols-2 gap-3">
                {avgPerWorker > 0 && (
                  <div className="rounded-lg bg-muted/30 px-4 py-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Média por trabalhador
                    </p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                      {formatCurrency(avgPerWorker)}
                    </p>
                  </div>
                )}
                {topWorker && topWorker.totalPaid > 0 && (
                  <div className="rounded-lg bg-muted/30 px-4 py-3">
                    <p className="text-xs font-medium text-muted-foreground">Maior pagamento</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-foreground" title={topWorker.name}>
                      {topWorker.name}
                    </p>
                    <p className="text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(topWorker.totalPaid)}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              {workers.map((w, i) => {
                const pct =
                  total > 0 && w.totalPaid > 0
                    ? ((w.totalPaid / total) * 100).toFixed(0)
                    : null;
                return (
                  <div
                    key={`${w.name}-${w.role || ""}-${i}`}
                    className="flex items-center justify-between gap-4 rounded-lg bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                          i % 6 === 0 && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                          i % 6 === 1 && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                          i % 6 === 2 && "bg-sky-500/15 text-sky-600 dark:text-sky-400",
                          i % 6 === 3 && "bg-violet-500/15 text-violet-600 dark:text-violet-400",
                          i % 6 === 4 && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                          i % 6 === 5 && "bg-slate-500/15 text-slate-600 dark:text-slate-400"
                        )}
                      >
                        <User className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{w.name}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {w.role ? (
                            <>
                              <Briefcase className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{w.role}</span>
                            </>
                          ) : (
                            <span>Sem função informada</span>
                          )}
                          {pct != null && (
                            <span className="shrink-0">· {pct}% do total</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(w.totalPaid)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto rounded-lg border-2 border-border bg-muted/20 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="font-semibold text-foreground">Total mão de obra</span>
                </div>
                <span className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
