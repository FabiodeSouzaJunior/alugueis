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

const defaultValues = {
  type: "",
  location: "",
  description: "",
  priority: "media",
  status: "pendente",
  spentValue: "",
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

export function MaintenanceForm({ task, onSave, onCancel, saving = false }) {
  const [form, setForm] = useState(defaultValues);
  const [validationError, setValidationError] = useState(null);

  useEffect(() => {
    if (task) {
      setForm({
        type: task.type || "",
        location: task.location || "",
        description: task.description || "",
        priority: task.priority || "media",
        status: task.status || "pendente",
        spentValue: task.spentValue != null ? formatCurrencyFromNumber(task.spentValue) : "",
      });
    } else {
      setForm(defaultValues);
    }
  }, [task]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (saving) return;
    setValidationError(null);
    const spentValue = parseCurrencyInput(form.spentValue);
    if (!Number.isFinite(spentValue) || spentValue < 0) {
      setValidationError("Informe um valor valido em R$.");
      return;
    }
    onSave({
      type: form.type.trim(),
      location: form.location.trim(),
      description: form.description.trim(),
      priority: form.priority,
      status: form.status,
      spentValue,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label>Tipo</Label>
          <Input
            value={form.type}
            onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
            placeholder="Ex: Elétrica, Pintura"
          />
        </div>
        <div className="grid gap-2">
          <Label>Local</Label>
          <Input
            value={form.location}
            onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
            placeholder="Ex: Kitnet 101, Área comum"
          />
        </div>
        <div className="grid gap-2">
          <Label>Descrição</Label>
          <Input
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Detalhes do serviço"
          />
        </div>
        <div className="grid gap-2">
          <Label>Valor gasto (R$)</Label>
          <Input
            type="text"
            inputMode="decimal"
            value={form.spentValue}
            onChange={(e) =>
              setForm((p) => ({ ...p, spentValue: formatCurrencyInput(e.target.value) }))
            }
            placeholder="0,00"
          />
        </div>
        <div className="grid gap-2">
          <Label>Prioridade</Label>
          <Select
            value={form.priority}
            onValueChange={(v) => setForm((p) => ({ ...p, priority: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
            </SelectContent>
          </Select>
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
          {saving ? "Salvando..." : task ? "Salvar" : "Adicionar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
