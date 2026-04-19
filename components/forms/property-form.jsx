"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";

const defaultValues = {
  name: "",
  unitCount: "",
  observacoes: "",
  estimatedValue: "",
};

export function PropertyForm({ property, onSave, onCancel }) {
  const [form, setForm] = useState(defaultValues);

  useEffect(() => {
    if (property) {
      setForm({
        name: property.name || "",
        unitCount: String(property.unitCount ?? ""),
        observacoes: property.observacoes || "",
        estimatedValue: property.estimatedValue != null && property.estimatedValue !== "" ? String(property.estimatedValue) : "",
      });
    } else {
      setForm(defaultValues);
    }
  }, [property]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const unitCount = Math.max(0, parseInt(form.unitCount, 10) || 0);
    const estimatedValue = form.estimatedValue.trim() !== "" && !isNaN(Number(form.estimatedValue)) ? Number(form.estimatedValue) : null;
    const payload = {
      name: form.name.trim() || "Sem nome",
      unitCount,
      observacoes: form.observacoes?.trim() || null,
      estimatedValue,
    };
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="property-name">Nome do imóvel</Label>
          <Input
            id="property-name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Ex: Edifício Central"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="unitCount">Quantidade de unidades / kitnets</Label>
          <Input
            id="unitCount"
            type="number"
            min={0}
            value={form.unitCount}
            onChange={(e) => setForm((p) => ({ ...p, unitCount: e.target.value }))}
            placeholder="0"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="estimatedValue">Valor estimado do imóvel (R$)</Label>
          <Input
            id="estimatedValue"
            type="number"
            min={0}
            step="0.01"
            value={form.estimatedValue}
            onChange={(e) => setForm((p) => ({ ...p, estimatedValue: e.target.value }))}
            placeholder="Opcional"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="observacoes">Observações</Label>
          <textarea
            id="observacoes"
            value={form.observacoes}
            onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
            placeholder="Anotações sobre o imóvel..."
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            rows={3}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">{property ? "Salvar" : "Adicionar"}</Button>
      </DialogFooter>
    </form>
  );
}
