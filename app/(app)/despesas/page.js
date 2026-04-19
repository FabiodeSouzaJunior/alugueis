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
import {
  Dialog,
  DialogContentWithClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExpenseForm } from "@/components/forms/expense-form";
import { formatCurrency, formatDate } from "@/lib/utils";
import { fetchExpenses, createExpense, updateExpense, deleteExpense } from "@/lib/api";
import { getExpensesForMonth, getCurrentMonthYear } from "@/lib/calculations";
import { Plus, Pencil, Trash2, Receipt } from "lucide-react";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function DespesasPage() {
  const [expenses, setExpensesState] = useState([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setLoading(true);
      const data = await fetchExpenses();
      const list = Array.isArray(data) ? data : [];
      setExpensesState([...list].sort((a, b) => (b.date > a.date ? 1 : -1)));
      const { month, year } = getCurrentMonthYear();
      const monthExpenses = getExpensesForMonth(list, month, year);
      setMonthTotal(monthExpenses.reduce((s, e) => s + Number(e.value || 0), 0));
    } catch (e) {
      console.error(e);
      setExpensesState([]);
      setMonthTotal(0);
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
      if (editingExpense) {
        await updateExpense(editingExpense.id, payload);
      } else {
        await createExpense(payload);
      }
      setDialogOpen(false);
      setEditingExpense(null);
      await load();
    } catch (e) {
      console.error(e);
      setSaveError(e?.message || "Erro ao salvar despesa.");
    } finally {
      setSaving(false);
    }
  }, [editingExpense, load]);

  const handleDeleteClick = (expense) => setDeleteConfirm(expense);
  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteExpense(deleteConfirm.id);
      setDeleteConfirm(null);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const { setPageHeader } = usePageHeader();
  useEffect(() => {
    setPageHeader({
      title: "Despesas",
      description: "Despesas do prédio — total do mês calculado automaticamente.",
      action: (
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingExpense(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingExpense(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar despesa
            </Button>
          </DialogTrigger>
          <DialogContentWithClose
            title={editingExpense ? "Editar despesa" : "Nova despesa"}
            onClose={() => { setDialogOpen(false); setEditingExpense(null); setSaveError(null); }}
          >
            {saveError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {saveError}
              </p>
            )}
            <ExpenseForm
              expense={editingExpense}
              onSave={handleSave}
              onCancel={() => { setDialogOpen(false); setEditingExpense(null); setSaveError(null); }}
              saving={saving}
            />
          </DialogContentWithClose>
        </Dialog>
      ),
    });
    return () => setPageHeader({ title: null, description: null, action: null });
  }, [setPageHeader, dialogOpen, editingExpense, handleSave]);

  return (
    <div className="space-y-6">
      <Card className="rounded-lg border border-border">
        <CardHeader>
          <CardTitle>Despesas do mês (atual)</CardTitle>
          <CardDescription>
            Total: <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(monthTotal)}</span>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="rounded-lg border border-border">
        <CardHeader>
          <CardTitle>Listagem</CardTitle>
          {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          <CardDescription>Tipo, valor, data e descrição</CardDescription>
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
            <SkeletonTable rows={5} cols={5} />
          ) : expenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nenhuma despesa registrada"
              description="Registre a primeira despesa para acompanhar os gastos."
              action={
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Registrar despesa
                </Button>
              }
            />
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.type}</TableCell>
                  <TableCell className="font-medium text-red-600 dark:text-red-400">{formatCurrency(e.value)}</TableCell>
                  <TableCell>{formatDate(e.date)}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {e.description || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingExpense(e);
                        setDialogOpen(true);
                      }}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(e)}
                      title="Excluir"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Excluir despesa"
        description={deleteConfirm ? `Excluir "${deleteConfirm.description || deleteConfirm.type || "esta despesa"}"?` : ""}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </div>
  );
}
