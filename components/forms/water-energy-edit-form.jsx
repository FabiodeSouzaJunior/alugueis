"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { updateWaterEnergyConsumption } from "@/lib/api";
import { getMonthName } from "@/lib/utils";

export function WaterEnergyEditForm({ record, tenantName, onSuccess, onCancel }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    waterUsage: record?.waterUsage != null ? String(record.waterUsage) : "",
    electricityUsage: record?.electricityUsage != null ? String(record.electricityUsage) : "",
    addToRent: record?.addToRent === true,
    notes: record?.notes ?? "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updateWaterEnergyConsumption(record.id, {
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

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4">
        <div className="grid gap-1">
          <Label className="text-muted-foreground">Inquilino</Label>
          <p className="text-sm font-medium">{tenantName ?? "—"}</p>
        </div>
        <div className="grid gap-1">
          <Label className="text-muted-foreground">Período</Label>
          <p className="text-sm font-medium">
            {getMonthName(record?.month)} {record?.year}
          </p>
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
            <Label htmlFor="edit-add-to-rent">Adicionar no aluguel</Label>
            <p className="text-xs text-muted-foreground">
              O valor de água e luz será somado ao aluguel do mês
            </p>
          </div>
          <Switch
            id="edit-add-to-rent"
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
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
