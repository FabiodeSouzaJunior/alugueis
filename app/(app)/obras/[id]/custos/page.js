"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { fetchObraCosts, createObraCost, updateObraCost, deleteObraCost } from "@/lib/api";
import { ObraCostForm } from "@/components/forms/obra-cost-form";
import { Plus, Pencil, Trash2, Package, Users, ExternalLink } from "lucide-react";

const CATEGORIES = ["Material", "Mão de obra", "Ferramentas", "Projeto", "Taxas", "Outros"];

export default function ObraCustosPage() {
  const params = useParams();
  const id = params?.id;
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState("__all__");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await fetchObraCosts(id);
      setCosts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setCosts([]);
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
        if (editingCost) {
          await updateObraCost(id, editingCost.id, payload);
        } else {
          await createObraCost(id, payload);
        }
        setDialogOpen(false);
        setEditingCost(null);
        await load();
      } catch (e) {
        console.error(e);
        setSaveError(e?.message || "Erro ao salvar.");
      } finally {
        setSaving(false);
      }
    },
    [id, editingCost, load]
  );

  const handleDelete = useCallback(
    async (costId) => {
      if (!id || !confirm("Excluir este gasto?")) return;
      try {
        await deleteObraCost(id, costId);
        await load();
      } catch (e) {
        console.error(e);
        alert(e?.message || "Erro ao excluir.");
      }
    },
    [id, load]
  );

  const filtered = useMemo(() => {
    if (filterCategory === "__all__") return costs;
    return costs.filter((c) => c.category === filterCategory);
  }, [costs, filterCategory]);

  const total = useMemo(() => filtered.reduce((s, c) => s + (Number(c.value) || 0), 0), [filtered]);

  if (!id) return null;

  return (
    <div className="space-y-6">
      <Card className="rounded-lg border border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Custos da obra</CardTitle>
          <CardDescription>Ledger financeiro: Material e Mão de obra vêm dos cadastros próprios; aqui você adiciona apenas outros gastos (Ferramentas, Projeto, Taxas, Outros).</CardDescription>
          <div className="mt-4 flex flex-wrap gap-4">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingCost(null); setSaveError(null); } }}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingCost(null)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar gasto
                </Button>
              </DialogTrigger>
              <DialogContentWithClose
                title={editingCost ? "Editar gasto" : "Novo gasto"}
                onClose={() => { setDialogOpen(false); setEditingCost(null); setSaveError(null); }}
              >
                {saveError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{saveError}</p>
                )}
                <ObraCostForm
                  cost={editingCost}
                  onSave={handleSave}
                  onCancel={() => { setDialogOpen(false); setEditingCost(null); setSaveError(null); }}
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
                Total (filtrado): <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
              </p>
              <Table mobileCards>
                <TableHeader>
                  <TableRow className="border-0 bg-muted/40 hover:bg-muted/40">
                    <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Data</TableHead>
                    <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Categoria</TableHead>
                    <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Descrição</TableHead>
                    <TableHead className="h-11 px-4 py-3 text-right font-semibold text-foreground tabular-nums">Valor</TableHead>
                    <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Responsável</TableHead>
                    <TableHead className="h-11 px-4 py-3 text-right font-semibold text-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow data-mobile-detail="true">
                      <TableCell data-mobile-full="true" colSpan={6} className="h-24 text-center text-muted-foreground">
                        Nenhum gasto encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => {
                      const isLinked = c.referenceType === "material" || c.referenceType === "worker";
                      return (
                        <TableRow key={c.id}>
                          <TableCell data-mobile-primary="true" className="px-4 py-3 text-muted-foreground">{formatDate(c.date)}</TableCell>
                          <TableCell data-label="Categoria" className="px-4 py-3">{c.category}</TableCell>
                          <TableCell data-label="Descricao" className="max-w-[200px] truncate px-4 py-3 max-sm:max-w-none max-sm:whitespace-normal" title={c.description ?? ""}>{c.description || "–"}</TableCell>
                          <TableCell data-label="Valor" className="px-4 py-3 text-right tabular-nums font-medium text-red-600 dark:text-red-400">{formatCurrency(c.value)}</TableCell>
                          <TableCell data-label="Responsavel" className="px-4 py-3 text-muted-foreground">{c.responsible || "–"}</TableCell>
                          <TableCell data-mobile-actions="true" className="px-4 py-3 text-right">
                            {isLinked ? (
                              <Link href={c.referenceType === "material" ? `/obras/${id}/materiais` : `/obras/${id}/trabalhadores`}>
                                <Button variant="outline" size="sm" className="gap-1">
                                  {c.referenceType === "material" ? <Package className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                                  Ver {c.referenceType === "material" ? "material" : "trabalhador"}
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              </Link>
                            ) : (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingCost(c); setDialogOpen(true); }} title="Editar">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)} title="Excluir">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
