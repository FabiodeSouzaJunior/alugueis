"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  User,
  Briefcase,
  DollarSign,
  Phone,
  FileText,
  Calendar,
  ListChecks,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function formatCreatedAt(iso) {
  if (!iso) return "–";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function WorkerDetailsModal({ worker, stages = [], open, onClose }) {
  if (!worker) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-xl border border-border bg-card p-0 shadow-lg sm:max-w-lg">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
          <DialogTitle className="text-base font-semibold text-foreground">
            Detalhes do trabalhador
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-foreground">{worker.name}</h3>
              {worker.role && (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Briefcase className="h-4 w-4 shrink-0" />
                  {worker.role}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
              <DollarSign className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Valor da diária</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(worker.dailyRate ?? 0)}
                </p>
              </div>
            </div>
            {worker.phone ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                <Phone className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Telefone</p>
                  <p className="truncate text-sm font-medium text-foreground">{worker.phone}</p>
                </div>
              </div>
            ) : null}
          </div>

          {worker.observacao ? (
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <p className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <FileText className="h-4 w-4 shrink-0" />
                Observação
              </p>
              <p className="whitespace-pre-wrap text-sm text-foreground">{worker.observacao}</p>
            </div>
          ) : null}

          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
            <Calendar className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Data de cadastro</p>
              <p className="text-sm text-foreground">{formatCreatedAt(worker.createdAt)}</p>
            </div>
          </div>

          {stages.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <ListChecks className="h-4 w-4 shrink-0" />
                Etapas vinculadas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {stages.map((st) => (
                  <Badge
                    key={st.id}
                    variant="secondary"
                    className={cn("text-xs font-normal")}
                  >
                    {st.name}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-3">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ListChecks className="h-4 w-4 shrink-0" />
                Nenhuma etapa vinculada
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-border bg-muted/20 px-6 py-3">
          <Button variant="outline" size="sm" className="w-full" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
