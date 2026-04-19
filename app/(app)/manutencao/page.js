"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContentWithClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MaintenanceForm } from "@/components/forms/maintenance-form";
import { formatDate, formatCurrency } from "@/lib/utils";
import { fetchMaintenance, createMaintenance, updateMaintenance } from "@/lib/api";
import { Fragment } from "react";
import { Plus, Pencil, ChevronDown, ChevronRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const priorityLabel = { alta: "Alta", media: "Média", baixa: "Baixa" };
const statusLabel = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

export default function ManutencaoPage() {
  const [tasks, setTasksState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [completingId, setCompletingId] = useState(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setLoading(true);
      const data = await fetchMaintenance();
      const list = Array.isArray(data) ? data : [];
      setTasksState([...list].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)));
    } catch (e) {
      console.error(e);
      setTasksState([]);
      setLoadError(e?.message || "Erro ao carregar. Verifique o servidor e o banco.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback(async (payload) => {
    setSaveError(null);
    setSaving(true);
    try {
      if (editingTask) {
        await updateMaintenance(editingTask.id, payload);
      } else {
        await createMaintenance(payload);
      }
      setDialogOpen(false);
      setEditingTask(null);
      await load();
    } catch (e) {
      console.error(e);
      setSaveError(e?.message || "Erro ao salvar tarefa.");
    } finally {
      setSaving(false);
    }
  }, [editingTask, load]);

  const { setPageHeader } = usePageHeader();
  useEffect(() => {
    setPageHeader({
      title: "Manutenção",
      description: "Tarefas de manutenção do prédio.",
      action: (
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingTask(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingTask(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar tarefa
            </Button>
          </DialogTrigger>
          <DialogContentWithClose
            title={editingTask ? "Editar tarefa" : "Nova tarefa de manutenção"}
            onClose={() => { setDialogOpen(false); setEditingTask(null); setSaveError(null); }}
          >
            {saveError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {saveError}
              </p>
            )}
            <MaintenanceForm
              task={editingTask}
              onSave={handleSave}
              onCancel={() => { setDialogOpen(false); setEditingTask(null); setSaveError(null); }}
              saving={saving}
            />
          </DialogContentWithClose>
        </Dialog>
      ),
    });
    return () => setPageHeader({ title: null, description: null, action: null });
  }, [setPageHeader, dialogOpen, editingTask, handleSave]);

  const handleToggleComplete = async (t) => {
    if (t.status === "concluido") return;
    setCompletingId(t.id);
    try {
      await updateMaintenance(t.id, {
        type: t.type,
        location: t.location ?? "",
        description: t.description ?? "",
        priority: t.priority || "media",
        status: "concluido",
        spentValue: t.spentValue ?? 0,
      });
      await load();
      setExpandedId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setCompletingId(null);
    }
  };

  const handleSetPendente = async (t) => {
    if (t.status !== "concluido") return;
    setCompletingId(t.id);
    try {
      await updateMaintenance(t.id, {
        type: t.type,
        location: t.location ?? "",
        description: t.description ?? "",
        priority: t.priority || "media",
        status: "pendente",
        spentValue: t.spentValue ?? 0,
      });
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-lg border border-border">
        <CardHeader>
          <CardTitle>Listagem</CardTitle>
          <CardDescription>Tipo, local, prioridade e status</CardDescription>
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
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" aria-label="Expandir" />
                <TableHead>Tipo</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor gasto</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    Nenhuma tarefa cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((t) => (
                  <Fragment key={t.id}>
                    <TableRow
                      className={cn(
                        "cursor-pointer transition-colors",
                        expandedId === t.id && "bg-muted/40"
                      )}
                      onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                    >
                      <TableCell className="w-10 py-3 align-middle">
                        <span className="inline-flex text-muted-foreground">
                          {expandedId === t.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{t.type}</TableCell>
                      <TableCell>{t.location}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{t.description || "-"}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCurrency(Number(t.spentValue) || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            t.priority === "alta"
                              ? "destructive"
                              : t.priority === "media"
                              ? "warning"
                              : "success"
                          }
                          className={
                            t.priority === "alta"
                              ? "bg-red-500/20 text-red-600 dark:bg-red-500/25 dark:text-red-300 border-red-500/30"
                              : t.priority === "media"
                              ? "bg-amber-500/20 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300 border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300 border-emerald-500/30"
                          }
                        >
                          {priorityLabel[t.priority] || t.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            t.status === "concluido"
                              ? "success"
                              : t.status === "em_andamento"
                              ? "warning"
                              : "warning"
                          }
                          className={
                            t.status === "concluido"
                              ? "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300 border-emerald-500/30"
                              : t.status === "em_andamento"
                              ? "bg-amber-500/20 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300 border-amber-500/30"
                              : "bg-amber-500/20 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300 border-amber-500/30"
                          }
                        >
                          {statusLabel[t.status] || t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(t.createdAt)}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingTask(t);
                            setDialogOpen(true);
                          }}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedId === t.id && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={9} className="border-t-0 bg-muted/20 p-0 align-top">
                          <div className="rounded-b-lg border-x border-b border-border/50 px-5 py-4 shadow-inner">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                  Descrição do problema
                                </p>
                                <p
                                  className={cn(
                                    "mt-1.5 text-sm leading-relaxed text-foreground",
                                    t.status === "concluido" && "line-through text-muted-foreground"
                                  )}
                                >
                                  {t.description || "Sem descrição."}
                                </p>
                                <div className="mt-3">
                                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Valor gasto
                                  </p>
                                  <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                                    {formatCurrency(Number(t.spentValue) || 0)}
                                  </p>
                                </div>
                              </div>
                              <div
                                className={cn(
                                  "flex shrink-0 items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
                                  t.status === "concluido"
                                    ? "border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15"
                                    : "border-border bg-card"
                                )}
                              >
                                {t.status === "concluido" ? (
                                  <label
                                    className={cn(
                                      "flex cursor-pointer items-center gap-3 text-sm font-medium text-emerald-700 dark:text-emerald-300",
                                      completingId === t.id && "pointer-events-none opacity-70"
                                    )}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked
                                      disabled={completingId === t.id}
                                      onChange={() => handleSetPendente(t)}
                                      className="sr-only"
                                      aria-label="Desmarcar conclusão"
                                    />
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-emerald-500 bg-emerald-500 text-white">
                                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                                    </span>
                                    <span>
                                      {completingId === t.id ? (
                                        <span className="flex items-center gap-2">
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                          Salvando...
                                        </span>
                                      ) : (
                                        "Concluída (clique para desmarcar)"
                                      )}
                                    </span>
                                  </label>
                                ) : (
                                  <label className="flex cursor-pointer items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={false}
                                      disabled={completingId === t.id}
                                      onChange={() => handleToggleComplete(t)}
                                      className="h-5 w-5 rounded border-2 border-border bg-background accent-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background"
                                    />
                                    <span className="text-sm font-medium">
                                      {completingId === t.id ? (
                                        <span className="flex items-center gap-2">
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                          Salvando...
                                        </span>
                                      ) : (
                                        "Marcar como concluída"
                                      )}
                                    </span>
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
