"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { formatDateInput } from "@/lib/utils";

export function ObraAgendaForm({ item, onSave, onCancel, saving }) {
  const [date, setDate] = useState("");
  const [activity, setActivity] = useState("");
  const [responsible, setResponsible] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (item) {
      setDate(item.date ? formatDateInput(item.date) : new Date().toISOString().split("T")[0]);
      setActivity(item.activity ?? "");
      setResponsible(item.responsible ?? "");
      setNotes(item.notes ?? "");
    } else {
      setDate(new Date().toISOString().split("T")[0]);
      setActivity("");
      setResponsible("");
      setNotes("");
    }
  }, [item]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      date: date || null,
      activity: activity.trim() || "Atividade",
      responsible: responsible.trim() || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label>Data</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div className="grid gap-2">
        <Label>Atividade</Label>
        <Input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="O que será feito" required />
      </div>
      <div className="grid gap-2">
        <Label>Responsável</Label>
        <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Opcional" />
      </div>
      <div className="grid gap-2">
        <Label>Observação</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
      </div>
      <DialogFooter className="gap-2 pt-2 sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </DialogFooter>
    </form>
  );
}
