"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createCondominiumExpense,
  updateCondominiumExpense,
  deleteCondominiumExpense,
} from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { getMonthName } from "@/lib/utils";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function ExpenseSplitManager({
  expenses = [],
  onRefresh,
  formatCurrency: formatCurrencyProp,
  propertyId,
}) {
  const format = formatCurrencyProp || formatCurrency;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    totalValue: "",
    expenseDate: "",
    numberOfUnits: "10",
    installments: "1",
    startMonth: new Date().getMonth() + 1,
    startYear: new Date().getFullYear(),
  });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const resetForm = () => {
    setEditing(null);
    setForm({
      name: "",
      totalValue: "",
      expenseDate: "",
      numberOfUnits: "10",
      installments: "1",
      startMonth: new Date().getMonth() + 1,
      startYear: new Date().getFullYear(),
    });
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (ex) => {
    setEditing(ex);
    setForm({
      name: ex.name ?? "",
      totalValue: String(ex.totalValue ?? ""),
      expenseDate: ex.expenseDate ?? "",
      numberOfUnits: String(ex.numberOfUnits ?? 10),
      installments: String(ex.installments ?? 1),
      startMonth: ex.startMonth ?? new Date().getMonth() + 1,
      startYear: ex.startYear ?? new Date().getFullYear(),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const totalValue = parseFloat(form.totalValue.replace(/,/g, ".")) || 0;
    const numberOfUnits = parseInt(form.numberOfUnits, 10) || 10;
    const installments = parseInt(form.installments, 10) || 1;
    setSubmitting(true);
    try {
      if (editing) {
        await updateCondominiumExpense(editing.id, {
          name: form.name,
          totalValue,
          expenseDate: form.expenseDate || null,
          numberOfUnits,
          installments,
          startMonth: form.startMonth,
          startYear: form.startYear,
          propertyId,
        });
      } else {
        await createCondominiumExpense({
          name: form.name,
          totalValue,
          expenseDate: form.expenseDate || null,
          numberOfUnits,
          installments,
          startMonth: form.startMonth,
          startYear: form.startYear,
          propertyId,
        });
      }
      setDialogOpen(false);
      resetForm();
      onRefresh?.();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteCondominiumExpense(id);
      onRefresh?.();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const perUnitPerMonth = (ex) => {
    const u = Math.max(1, Number(ex.numberOfUnits));
    const i = Math.max(1, Number(ex.installments));
    return (Number(ex.totalValue) || 0) / u / i;
  };

  return (
    <>
      <Card className="overflow-hidden rounded-xl border border-[hsl(var(--condo-accent)/0.25)] shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b border-[hsl(var(--condo-accent)/0.2)] bg-[hsl(var(--condo-accent)/0.06)]">
          <div>
            <CardTitle className="text-base font-semibold text-[hsl(var(--condo-accent))]">Rateio de obras e despesas</CardTitle>
            <CardDescription>
              Despesas extras rateadas entre as unidades (ex.: reforma, pintura, melhorias).
            </CardDescription>
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Nova despesa
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          {expenses.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 py-8 text-center text-sm text-muted-foreground">
              Nenhuma despesa de rateio cadastrada. Clique em &quot;Nova despesa&quot; para adicionar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
                  <TableHead className="text-center">Unidades</TableHead>
                  <TableHead className="text-center">Parcelas</TableHead>
                  <TableHead className="text-right">Valor/un./mês</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((ex) => (
                  <TableRow key={ex.id}>
                    <TableCell className="font-medium">{ex.name || "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">{format(ex.totalValue)}</TableCell>
                    <TableCell className="text-center">{ex.numberOfUnits}</TableCell>
                    <TableCell className="text-center">{ex.installments}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {format(perUnitPerMonth(ex))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getMonthName(ex.startMonth)}/{ex.startYear}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(ex)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(ex.id)}
                          disabled={deletingId === ex.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar despesa" : "Nova despesa (rateio)"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="exp-name">Nome da despesa</Label>
              <Input
                id="exp-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Reforma da fachada"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exp-total">Valor total (R$)</Label>
                <Input
                  id="exp-total"
                  type="text"
                  inputMode="decimal"
                  value={form.totalValue}
                  onChange={(e) => setForm((f) => ({ ...f, totalValue: e.target.value }))}
                  placeholder="10000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-date">Data (opcional)</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exp-units">Nº de unidades</Label>
                <Input
                  id="exp-units"
                  type="number"
                  min={1}
                  value={form.numberOfUnits}
                  onChange={(e) => setForm((f) => ({ ...f, numberOfUnits: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-inst">Parcelas (meses)</Label>
                <Input
                  id="exp-inst"
                  type="number"
                  min={1}
                  value={form.installments}
                  onChange={(e) => setForm((f) => ({ ...f, installments: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês/ano início</Label>
                <div className="flex gap-2">
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={form.startMonth}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startMonth: parseInt(e.target.value, 10) }))
                    }
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {getMonthName(m)?.slice(0, 3)}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={2020}
                    max={2030}
                    value={form.startYear}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startYear: parseInt(e.target.value, 10) || form.startYear }))
                    }
                    className="w-20"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {editing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
