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
import { Switch } from "@/components/ui/switch";
import { createWaterEnergyConsumption } from "@/lib/api";
import { getCurrentMonthYear } from "@/lib/calculations";
import { getMonthName } from "@/lib/utils";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function WaterEnergyConsumptionForm({ tenants = [], onSuccess, onCancel }) {
  const { month: defaultMonth, year: defaultYear } = getCurrentMonthYear();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    tenantId: "",
    month: String(defaultMonth),
    year: String(defaultYear),
    waterUsage: "",
    electricityUsage: "",
    addToRent: false,
    notes: "",
  });

  useEffect(() => {
    setForm((p) => ({
      ...p,
      month: String(defaultMonth),
      year: String(defaultYear),
    }));
  }, [defaultMonth, defaultYear]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const tenantId = form.tenantId?.trim();
    if (!tenantId) {
      setError("Selecione o inquilino.");
      return;
    }
    const month = Number(form.month);
    const year = Number(form.year);
    if (!month || month < 1 || month > 12 || !year || year < 2000) {
      setError("Mês e ano inválidos.");
      return;
    }
    setSaving(true);
    try {
      await createWaterEnergyConsumption({
        tenantId,
        month,
        year,
        waterUsage: Number(form.waterUsage) || 0,
        electricityUsage: Number(form.electricityUsage) || 0,
        addToRent: form.addToRent,
        notes: form.notes?.trim() || null,
      });
      onSuccess?.();
    } catch (err) {
      setError(err?.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 2 + i);

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label>Inquilino</Label>
          <Select
            value={form.tenantId}
            onValueChange={(v) => setForm((p) => ({ ...p, tenantId: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o inquilino" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name ?? t.kitnetNumber ?? t.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Mês</Label>
            <Select
              value={form.month}
              onValueChange={(v) => setForm((p) => ({ ...p, month: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {getMonthName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Ano</Label>
            <Select
              value={form.year}
              onValueChange={(v) => setForm((p) => ({ ...p, year: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Consumo de água</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.waterUsage}
            onChange={(e) => setForm((p) => ({ ...p, waterUsage: e.target.value }))}
            placeholder="0,00"
          />
        </div>
        <div className="grid gap-2">
          <Label>Consumo de luz</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.electricityUsage}
            onChange={(e) => setForm((p) => ({ ...p, electricityUsage: e.target.value }))}
            placeholder="0,00"
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="add-to-rent">Adicionar no aluguel</Label>
            <p className="text-xs text-muted-foreground">
              O valor de água e luz será somado ao aluguel do mês
            </p>
          </div>
          <Switch
            id="add-to-rent"
            checked={form.addToRent}
            onCheckedChange={(v) => setForm((p) => ({ ...p, addToRent: v }))}
          />
        </div>
        <div className="grid gap-2">
          <Label>Observações (opcional)</Label>
          <Input
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Notas sobre o consumo"
          />
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Registrar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
