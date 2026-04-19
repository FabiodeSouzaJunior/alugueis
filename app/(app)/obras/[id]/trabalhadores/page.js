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
import { formatCurrency } from "@/lib/utils";
import { fetchObraWorkers, fetchObraStages, fetchObraStageWorkers, createObraWorker, updateObraWorker, deleteObraWorker } from "@/lib/api";
import { ObraWorkerForm } from "@/components/forms/obra-worker-form";
import { WorkerDetailsModal } from "@/components/workers/WorkerDetailsModal";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";

export default function ObraTrabalhadoresPage() {
  const params = useParams();
  const id = params?.id;
  const [workers, setWorkers] = useState([]);
  const [stages, setStages] = useState([]);
  const [stageWorkers, setStageWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [detailsWorker, setDetailsWorker] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [workersData, stagesData, linksData] = await Promise.all([
        fetchObraWorkers(id),
        fetchObraStages(id),
        fetchObraStageWorkers(id),
      ]);
      setWorkers(Array.isArray(workersData) ? workersData : []);
      setStages(Array.isArray(stagesData) ? stagesData : []);
      setStageWorkers(Array.isArray(linksData) ? linksData : []);
    } catch (e) {
      console.error(e);
      setWorkers([]);
      setStages([]);
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
        if (editingWorker) {
          await updateObraWorker(id, editingWorker.id, payload);
        } else {
          await createObraWorker(id, payload);
        }
        setDialogOpen(false);
        setEditingWorker(null);
        await load();
      } catch (e) {
        console.error(e);
        setSaveError(e?.message || "Erro ao salvar.");
      } finally {
        setSaving(false);
      }
    },
    [id, editingWorker, load]
  );

  const handleDelete = useCallback(
    async (workerId) => {
      if (!id || !confirm("Excluir este trabalhador?")) return;
      try {
        await deleteObraWorker(id, workerId);
        await load();
      } catch (e) {
        console.error(e);
        alert(e?.message || "Erro ao excluir.");
      }
    },
    [id, load]
  );

  const totalPaid = useMemo(
    () => workers.reduce((s, w) => s + (Number(w.totalPaid) || 0), 0),
    [workers]
  );

  const stagesByWorker = useMemo(() => {
    const map = {};
    workers.forEach((w) => { map[w.id] = []; });
    stageWorkers.forEach((sw) => {
      if (map[sw.workerId]) map[sw.workerId].push(sw);
    });
    return map;
  }, [workers, stageWorkers]);

  if (!id) return null;

  return (
    <div className="space-y-6">
      <Card className="rounded-lg border border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Trabalhadores da obra</CardTitle>
          <CardDescription>Registre os trabalhadores e dias trabalhados. O total pago é calculado automaticamente.</CardDescription>
          <div className="mt-4">
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingWorker(null); setSaveError(null); } }}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingWorker(null)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Registrar trabalhador
                </Button>
              </DialogTrigger>
              <DialogContentWithClose
                title={editingWorker ? "Editar trabalhador" : "Novo trabalhador"}
                onClose={() => { setDialogOpen(false); setEditingWorker(null); setSaveError(null); }}
              >
                {saveError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{saveError}</p>
                )}
                <ObraWorkerForm
                  worker={editingWorker}
                  onSave={handleSave}
                  onCancel={() => { setDialogOpen(false); setEditingWorker(null); setSaveError(null); }}
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
            <>
              <p className="mb-4 text-sm font-medium text-muted-foreground">
                Total pago (mão de obra): <span className="font-semibold text-foreground">{formatCurrency(totalPaid)}</span>
              </p>
              <Table>
                <TableHeader>
                  <TableRow className="border-0 bg-muted/40 hover:bg-muted/40">
                    <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Nome</TableHead>
                    <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Função</TableHead>
                    <TableHead className="h-11 px-4 py-3 text-right font-semibold text-foreground tabular-nums">Valor da diária</TableHead>
                    <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Status</TableHead>
                    <TableHead className="h-11 w-32 px-4 py-3 text-right font-semibold text-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Nenhum trabalhador registrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    workers.map((w) => {
                      const workerLinks = stagesByWorker[w.id] || [];
                      const workerStageIds = workerLinks.map((sw) => sw.stageId);
                      const workerStages = stages.filter((s) => workerStageIds.includes(s.id));
                      return (
                        <TableRow key={w.id}>
                          <TableCell className="px-4 py-3 font-medium">{w.name}</TableCell>
                          <TableCell className="px-4 py-3 text-muted-foreground">{w.role || "–"}</TableCell>
                          <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatCurrency(w.dailyRate)}</TableCell>
                          <TableCell className="px-4 py-3">
                            <span className="text-muted-foreground">Ativo</span>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailsWorker({ worker: w, stages: workerStages })} title="Detalhes">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingWorker(w); setDialogOpen(true); }} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(w.id)} title="Excluir">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              <WorkerDetailsModal
                worker={detailsWorker?.worker ?? null}
                stages={detailsWorker?.stages ?? []}
                open={!!detailsWorker}
                onClose={() => setDetailsWorker(null)}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
