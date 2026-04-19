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
import { formatCurrency, formatDate } from "@/lib/utils";
import { fetchObraMaterials, createObraMaterial, updateObraMaterial, deleteObraMaterial } from "@/lib/api";
import { ObraMaterialForm } from "@/components/forms/obra-material-form";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function ObraMateriaisPage() {
  const params = useParams();
  const id = params?.id;
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await fetchObraMaterials(id);
      setMaterials(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setMaterials([]);
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
        if (editingMaterial) {
          await updateObraMaterial(id, editingMaterial.id, payload);
        } else {
          await createObraMaterial(id, payload);
        }
        setDialogOpen(false);
        setEditingMaterial(null);
        await load();
      } catch (e) {
        console.error(e);
        setSaveError(e?.message || "Erro ao salvar.");
      } finally {
        setSaving(false);
      }
    },
    [id, editingMaterial, load]
  );

  const handleDelete = useCallback(
    async (materialId) => {
      if (!id || !confirm("Excluir este material?")) return;
      try {
        await deleteObraMaterial(id, materialId);
        await load();
      } catch (e) {
        console.error(e);
        alert(e?.message || "Erro ao excluir.");
      }
    },
    [id, load]
  );

  const totalMaterials = useMemo(
    () => materials.reduce((s, m) => s + (Number(m.totalValue) || 0), 0),
    [materials]
  );

  if (!id) return null;

  return (
    <div className="space-y-6">
      <Card className="rounded-lg border border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Materiais da obra</CardTitle>
          <CardDescription>Registre as compras de materiais. Valor total calculado automaticamente.</CardDescription>
          <div className="mt-4">
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingMaterial(null); setSaveError(null); } }}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingMaterial(null)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Registrar material
                </Button>
              </DialogTrigger>
              <DialogContentWithClose
                title={editingMaterial ? "Editar material" : "Novo material"}
                onClose={() => { setDialogOpen(false); setEditingMaterial(null); setSaveError(null); }}
              >
                {saveError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{saveError}</p>
                )}
                <ObraMaterialForm
                  material={editingMaterial}
                  onSave={handleSave}
                  onCancel={() => { setDialogOpen(false); setEditingMaterial(null); setSaveError(null); }}
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
                Custo total em materiais: <span className="font-semibold text-foreground">{formatCurrency(totalMaterials)}</span>
              </p>
              <Table>
                <TableHeader>
                  <TableRow className="border-0 bg-muted/40 hover:bg-muted/40">
                    <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Material</TableHead>
                    <TableHead className="h-11 px-4 py-3 text-right font-semibold text-foreground tabular-nums">Qtd</TableHead>
                    <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Un</TableHead>
                    <TableHead className="h-11 px-4 py-3 text-right font-semibold text-foreground tabular-nums">Preço un.</TableHead>
                    <TableHead className="h-11 px-4 py-3 text-right font-semibold text-foreground tabular-nums">Total</TableHead>
                    <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Fornecedor</TableHead>
                    <TableHead className="h-11 px-4 py-3 font-semibold text-foreground">Data compra</TableHead>
                    <TableHead className="h-11 w-24 px-4 py-3 text-right font-semibold text-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        Nenhum material registrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    materials.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="px-4 py-3 font-medium">{m.materialName}</TableCell>
                        <TableCell className="px-4 py-3 text-right tabular-nums">{Number(m.quantity)}</TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">{m.unit}</TableCell>
                        <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatCurrency(m.unitPrice)}</TableCell>
                        <TableCell className="px-4 py-3 text-right tabular-nums font-medium text-red-600 dark:text-red-400">{formatCurrency(m.totalValue)}</TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">{m.supplier || "–"}</TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">{formatDate(m.purchaseDate) || "–"}</TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingMaterial(m); setDialogOpen(true); }} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(m.id)} title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
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
