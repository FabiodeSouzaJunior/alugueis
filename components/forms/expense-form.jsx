"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { formatDateInput } from "@/lib/utils";

const expenseTypes = [
  "Pintura",
  "Elétrica",
  "Hidráulica",
  "Manutenção geral",
  "Limpeza",
  "Outros",
];

const defaultValues = {
  type: "",
  value: "",
  date: "",
  description: "",
};

function formatCurrencyInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const amount = Number(digits) / 100;
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrencyFromNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrencyInput(value) {
  if (value == null || value === "") return 0;
  const normalized = String(value)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function ExpenseForm({ expense, onSave, onCancel, saving = false }) {
  const [form, setForm] = useState(defaultValues);
  const [validationError, setValidationError] = useState(null);

  useEffect(() => {
    if (expense) {
      setForm({
        type: expense.type || "",
        value: expense.value != null ? formatCurrencyFromNumber(expense.value) : "",
        date: formatDateInput(expense.date) || "",
        description: expense.description || "",
      });
    } else {
      const today = new Date().toISOString().split("T")[0];
      setForm({ ...defaultValues, date: today });
    }
  }, [expense]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (saving) return;
    setValidationError(null);
    const value = parseCurrencyInput(form.value);
    if (!Number.isFinite(value) || value < 0) {
      setValidationError("Informe um valor valido em R$.");
      return;
    }
    onSave({
      type: form.type.trim() || "Outros",
      value,
      date: form.date || new Date().toISOString().split("T")[0],
      description: form.description.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label>Tipo</Label>
          <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {expenseTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Valor (R$)</Label>
          <Input
            type="text"
            inputMode="decimal"
            value={form.value}
            onChange={(e) =>
              setForm((p) => ({ ...p, value: formatCurrencyInput(e.target.value) }))
            }
            placeholder="0,00"
          />
        </div>
        <div className="grid gap-2">
          <Label>Data</Label>
          <Input
            type="date"
            value={form.date}
            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
          />
        </div>
        <div className="grid gap-2">
          <Label>Descrição</Label>
          <Input
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Opcional"
          />
        </div>
        {validationError && (
          <p className="text-sm text-destructive">{validationError}</p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : expense ? "Salvar" : "Adicionar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
