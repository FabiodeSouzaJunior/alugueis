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
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "Pendente", label: "Pendente", dotClass: "bg-red-500" },
  { value: "Em andamento", label: "Em andamento", dotClass: "bg-amber-500" },
  { value: "Concluído", label: "Concluído", dotClass: "bg-emerald-500" },
];

export function ObraStageForm({ stage, onSave, onCancel, saving }) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("Pendente");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [responsible, setResponsible] = useState("");

  useEffect(() => {
    if (stage) {
      setName(stage.name ?? "");
      setStatus(stage.status || "Pendente");
      setStartDate(stage.startDate ? formatDateInput(stage.startDate) : "");
      setDueDate(stage.dueDate ? formatDateInput(stage.dueDate) : "");
      setResponsible(stage.responsible ?? "");
    } else {
      setName("");
      setStatus("Pendente");
      setStartDate("");
      setDueDate("");
      setResponsible("");
    }
  }, [stage]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name: name.trim() || "Etapa",
      status,
      startDate: startDate || null,
      dueDate: dueDate || null,
      responsible: responsible.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label>Nome da etapa</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Fundação" required />
      </div>
      <div className="grid gap-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10 w-full border border-input bg-background text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            className="max-h-[var(--radix-select-content-available-height)] border border-border bg-card text-card-foreground shadow-md"
            position="popper"
          >
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                className="cursor-pointer focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
              >
                <span className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", opt.dotClass)} aria-hidden />
                  {opt.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Data início</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Data prevista</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Responsável</Label>
        <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Opcional" />
      </div>
      <DialogFooter className="gap-2 pt-2 sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </DialogFooter>
    </form>
  );
}
