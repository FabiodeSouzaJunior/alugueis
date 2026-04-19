"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
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
import {
  Dialog,
  DialogContentWithClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { fetchObraStages, fetchObraWorkers, fetchObraStageWorkers, createObraStage, updateObraStage, deleteObraStage, createObraStageWorker, deleteObraStageWorker } from "@/lib/api";
import { ObraStageForm } from "@/components/forms/obra-stage-form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ChevronDown, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  Pendente: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  "Em andamento": "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  Concluído: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};

const STATUS_OPTIONS = ["Pendente", "Em andamento", "Concluído"];

export default function ObraEtapasPage() {
  const params = useParams();
  const id = params?.id;
  const [stages, setStages] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [stageWorkers, setStageWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [addingWorkerStageId, setAddingWorkerStageId] = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [stagesData, workersData, linksData] = await Promise.all([
        fetchObraStages(id),
        fetchObraWorkers(id),
        fetchObraStageWorkers(id),
      ]);
      setStages(Array.isArray(stagesData) ? stagesData : []);
      setWorkers(Array.isArray(workersData) ? workersData : []);
      setStageWorkers(Array.isArray(linksData) ? linksData : []);
    } catch (e) {
      console.error(e);
      setStages([]);
      setWorkers([]);
      setStageWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback(
    async (payload) => {
      if (!id) return;
      setSaveError(null);
      setSaving(true);
      try {
        if (editingStage) {
          await updateObraStage(id, editingStage.id, payload);
        } else {
          await createObraStage(id, payload);
        }
        setDialogOpen(false);
        setEditingStage(null);
        await load();
      } catch (e) {
        console.error(e);
        setSaveError(e?.message || "Erro ao salvar.");
      } finally {
        setSaving(false);
      }
    },
    [id, editingStage, load]
  );

  const handleDelete = useCallback(
    async (stageId) => {
      if (!id || !confirm("Excluir esta etapa?")) return;
      try {
        await deleteObraStage(id, stageId);
        await load();
      } catch (e) {
        console.error(e);
        alert(e?.message || "Erro ao excluir.");
      }
    },
    [id, load]
  );

  const handleStatusChange = useCallback(
    async (stage, newStatus) => {
      if (!id || stage.status === newStatus) return;
      const previous = stages.find((s) => s.id === stage.id);
      setStages((prev) =>
        prev.map((s) => (s.id === stage.id ? { ...s, status: newStatus } : s))
      );
      try {
        await updateObraStage(id, stage.id, {
          name: stage.name,
          status: newStatus,
          startDate: stage.startDate,
          dueDate: stage.dueDate,
          responsible: stage.responsible,
        });
      } catch (e) {
        console.error(e);
        if (previous) setStages((p) => p.map((s) => (s.id === stage.id ? previous : s)));
        alert(e?.message || "Erro ao atualizar status.");
      }
    },
    [id, stages]
  );

  const progressPct = useMemo(() => {
    if (stages.length === 0) return 0;
    const done = stages.filter((s) => s.status === "Concluído").length;
    return Math.round((done / stages.length) * 100);
  }, [stages]);

  const workersByStage = useMemo(() => {
    const map = {};
    stages.forEach((s) => { map[s.id] = []; });
    stageWorkers.forEach((sw) => {
      if (map[sw.stageId]) map[sw.stageId].push(sw);
    });
    return map;
  }, [stages, stageWorkers]);

  const handleAddWorkerToStage = useCallback(
    async (stageId, workerId) => {
      if (!id || !workerId) return;
      setAddingWorkerStageId(null);
      try {
        await createObraStageWorker(id, { stageId, workerId });
        await load();
      } catch (e) {
        console.error(e);
        alert(e?.message || "Erro ao vincular trabalhador.");
      }
    },
    [id, load]
  );

  const handleRemoveWorkerFromStage = useCallback(
    async (linkId) => {
      if (!id || !confirm("Remover este trabalhador da etapa?")) return;
      try {
        await deleteObraStageWorker(id, linkId);
        await load();
      } catch (e) {
        console.error(e);
        alert(e?.message || "Erro ao remover vínculo.");
      }
    },
    [id, load]
  );

  if (!id) return null;

  return (
    <div className="space-y-6">
      <Card className="rounded-lg border border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Etapas da obra</CardTitle>
          <CardDescription>Controle o progresso. Status: Pendente, Em andamento ou Concluído.</CardDescription>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Progresso geral:</span>
              <span className="text-lg font-bold">{progressPct}%</span>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingStage(null); setSaveError(null); } }}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingStage(null)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova etapa
                </Button>
              </DialogTrigger>
              <DialogContentWithClose
                title={editingStage ? "Editar etapa" : "Nova etapa"}
                onClose={() => { setDialogOpen(false); setEditingStage(null); setSaveError(null); }}
              >
                {saveError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{saveError}</p>
                )}
                <ObraStageForm
                  stage={editingStage}
                  onSave={handleSave}
                  onCancel={() => { setDialogOpen(false); setEditingStage(null); setSaveError(null); }}
                  saving={saving}
                />
              </DialogContentWithClose>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-0 bg-muted/40 hover:bg-muted/40">
                  <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Etapa</TableHead>
                  <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Status</TableHead>
                  <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Trabalhadores</TableHead>
                  <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Início</TableHead>
                  <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Previsão</TableHead>
                  <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Responsável</TableHead>
                  <TableHead className="h-11 w-24 px-4 py-3 text-right font-semibold text-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Nenhuma etapa cadastrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  stages.map((s) => {
                    const stageLinks = workersByStage[s.id] || [];
                    const linkedWorkerIds = new Set(stageLinks.map((sw) => sw.workerId));
                    const availableWorkers = workers.filter((w) => !linkedWorkerIds.has(w.id));
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="px-4 py-3 font-medium">{s.name}</TableCell>
                        <TableCell className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                                  STATUS_CONFIG[s.status] || STATUS_CONFIG.Pendente
                                )}
                              >
                                {s.status}
                                <ChevronDown className="h-3 w-3 opacity-70" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="min-w-[10rem] bg-card text-card-foreground">
                              {STATUS_OPTIONS.map((opt) => (
                                <DropdownMenuItem
                                  key={opt}
                                  onClick={() => handleStatusChange(s, opt)}
                                  className="cursor-pointer focus:bg-accent focus:text-accent-foreground"
                                >
                                  {opt}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {stageLinks.map((sw) => {
                              const w = workers.find((x) => x.id === sw.workerId);
                              return (
                                <Badge
                                  key={sw.id}
                                  variant="secondary"
                                  className="gap-1 pr-1 text-xs font-normal"
                                >
                                  <span className="opacity-80">👷</span>
                                  {w?.name ?? "–"}
                                  <button
                                    type="button"
                                    className="ml-0.5 rounded p-0.5 hover:bg-muted-foreground/20"
                                    onClick={() => handleRemoveWorkerFromStage(sw.id)}
                                    title="Remover da etapa"
                                    aria-label="Remover"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              );
                            })}
                            {addingWorkerStageId === s.id ? (
                              <Select
                                onValueChange={(workerId) => {
                                  if (workerId && workerId !== "__none__") handleAddWorkerToStage(s.id, workerId);
                                }}
                                onOpenChange={(open) => !open && setAddingWorkerStageId(null)}
                              >
                                <SelectTrigger className="h-8 w-[160px]">
                                  <SelectValue placeholder="Selecionar trabalhador" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableWorkers.length === 0 ? (
                                    <SelectItem value="__none__" disabled>Nenhum disponível</SelectItem>
                                  ) : (
                                    availableWorkers.map((w) => (
                                      <SelectItem key={w.id} value={w.id}>
                                        {w.name}{w.role ? ` – ${w.role}` : ""}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 text-xs"
                                onClick={() => setAddingWorkerStageId(s.id)}
                                title="Adicionar trabalhador"
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                                Adicionar trabalhador
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">{formatDate(s.startDate) || "–"}</TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">{formatDate(s.dueDate) || "–"}</TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">{s.responsible || "–"}</TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingStage(s); setDialogOpen(true); }} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)} title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
