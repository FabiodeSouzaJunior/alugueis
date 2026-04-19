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
import { createCondominiumBaseValue, deleteCondominiumBaseValue } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

export function CondominiumBaseValueManager({
  baseValues = [],
  onRefresh,
  formatCurrency: formatCurrencyProp,
  propertyId,
}) {
  const format = formatCurrencyProp || formatCurrency;
  const [value, setValue] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [feedback, setFeedback] = useState({ type: null, message: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: null, message: "" });

    if (!propertyId) {
      setFeedback({
        type: "error",
        message: "Selecione um imovel antes de adicionar o valor base do condominio.",
      });
      return;
    }

    const normalizedValue = String(value || "").trim().replace(/\./g, "").replace(",", ".");
    const num = Number(normalizedValue);
    if (!Number.isFinite(num) || num < 0) {
      setFeedback({
        type: "error",
        message: "Informe um valor valido maior ou igual a zero.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await createCondominiumBaseValue({
        value: num,
        startDate: startDate || new Date().toISOString().split("T")[0],
        propertyId,
      });
      setValue("");
      setStartDate(new Date().toISOString().split("T")[0]);
      await onRefresh?.();
      setFeedback({
        type: "success",
        message: "Valor base do condominio adicionado com sucesso.",
      });
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        message: err?.message || "Nao foi possivel adicionar o valor base do condominio.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    setFeedback({ type: null, message: "" });
    setDeletingId(id);
    try {
      await deleteCondominiumBaseValue(id);
      await onRefresh?.();
      setFeedback({
        type: "success",
        message: "Valor base do condominio removido com sucesso.",
      });
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        message: err?.message || "Nao foi possivel remover o valor base do condominio.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const sorted = [...baseValues].sort(
    (a, b) => new Date(b.startDate) - new Date(a.startDate)
  );

  return (
    <Card className="overflow-hidden rounded-xl border border-[hsl(var(--condo-accent)/0.25)] shadow-sm">
      <CardHeader className="border-b border-[hsl(var(--condo-accent)/0.2)] bg-[hsl(var(--condo-accent)/0.06)]">
        <CardTitle className="text-base font-semibold text-[hsl(var(--condo-accent))]">
          Valor base do condominio
        </CardTitle>
        <CardDescription>
          Defina o valor base e a data de inicio. O historico de reajustes fica registrado abaixo.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="mb-6 flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="cond-base-value">Valor (R$)</Label>
            <Input
              id="cond-base-value"
              type="text"
              inputMode="decimal"
              placeholder="250,00"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-36"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cond-base-date">Data de inicio</Label>
            <Input
              id="cond-base-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
              required
            />
          </div>
          <Button type="submit" disabled={submitting || !propertyId} size="default">
            <Plus className="mr-2 h-4 w-4" />
            {submitting ? "Salvando..." : "Adicionar valor"}
          </Button>
        </form>

        {feedback.message ? (
          <p
            className={`mb-4 rounded-md px-3 py-2 text-sm ${
              feedback.type === "error"
                ? "bg-destructive/10 text-destructive"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            }`}
            aria-live="polite"
          >
            {feedback.message}
          </p>
        ) : null}

        <div>
          <h4 className="mb-3 text-sm font-semibold text-muted-foreground">
            Historico de reajustes
          </h4>
          {sorted.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 py-8 text-center text-sm text-muted-foreground">
              Nenhum valor base cadastrado. Adicione o primeiro acima.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data de inicio</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.startDate
                        ? new Date(`${row.startDate}T12:00:00`).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {format(row.value)}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(row.id)}
                        disabled={deletingId === row.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
