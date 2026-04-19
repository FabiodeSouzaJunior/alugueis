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

/** Apenas categorias permitidas para custos manuais (ledger). Material e Mão de obra são gerados pelas páginas de Materiais e Trabalhadores. */
export const MANUAL_COST_CATEGORIES = ["Ferramentas", "Projeto", "Taxas", "Outros"];
const CATEGORIES = MANUAL_COST_CATEGORIES;

export function ObraCostForm({ cost, onSave, onCancel, saving }) {
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("Outros");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [responsible, setResponsible] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (cost) {
      setDate(cost.date ? formatDateInput(cost.date) : new Date().toISOString().split("T")[0]);
      setCategory(CATEGORIES.includes(cost.category) ? cost.category : "Outros");
      setDescription(cost.description ?? "");
      setValue(cost.value != null ? String(cost.value) : "");
      setResponsible(cost.responsible ?? "");
      setNotes(cost.notes ?? "");
    } else {
      setDate(new Date().toISOString().split("T")[0]);
      setCategory("Outros");
      setDescription("");
      setValue("");
      setResponsible("");
      setNotes("");
    }
  }, [cost]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const num = value !== "" && !isNaN(Number(value)) ? Number(value) : 0;
    if (num < 0) return;
    onSave({
      date: date || null,
      category,
      description: description.trim() || null,
      value: num,
      responsible: responsible.trim() || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label>Data</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label>Categoria</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Descrição</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do gasto" />
      </div>
      <div className="grid gap-2">
        <Label>Valor (R$)</Label>
        <Input type="number" step="0.01" min="0" value={value} onChange={(e) => setValue(e.target.value)} required />
      </div>
      <div className="grid gap-2">
        <Label>Responsável</Label>
        <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Opcional" />
      </div>
      <div className="grid gap-2">
        <Label>Observações</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
      </div>
      <DialogFooter className="gap-2 pt-2 sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </DialogFooter>
    </form>
  );
}
