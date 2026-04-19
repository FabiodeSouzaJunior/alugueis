"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ObraWorkerForm({ worker, onSave, onCancel, saving }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [daysWorked, setDaysWorked] = useState("");
  const [phone, setPhone] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (worker) {
      setName(worker.name ?? "");
      setRole(worker.role ?? "");
      setDailyRate(worker.dailyRate != null ? String(worker.dailyRate) : "");
      setDaysWorked(worker.daysWorked != null ? String(worker.daysWorked) : "");
      setPhone(worker.phone ?? "");
      setObservacao(worker.observacao ?? "");
    } else {
      setName("");
      setRole("");
      setDailyRate("");
      setDaysWorked("");
      setPhone("");
      setObservacao("");
    }
  }, [worker]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const rate = dailyRate !== "" && !isNaN(Number(dailyRate)) ? Number(dailyRate) : 0;
    const days = daysWorked !== "" && !isNaN(Number(daysWorked)) ? Number(daysWorked) : 0;
    onSave({
      name: name.trim() || "Trabalhador",
      role: role.trim() || null,
      dailyRate: rate,
      daysWorked: days,
      phone: phone.trim() || null,
      observacao: observacao.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label>Nome</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do trabalhador" required />
      </div>
      <div className="grid gap-2">
        <Label>Função</Label>
        <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex: Pedreiro, Eletricista" />
      </div>
      <div className="grid gap-2">
        <Label>Telefone</Label>
        <Input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(48) 99999-9999"
          inputMode="tel"
        />
      </div>
      <div className="grid gap-2">
        <Label>Valor da diária (R$)</Label>
        <Input type="number" step="0.01" min="0" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} required />
      </div>
      <div className="grid gap-2">
        <Label>Dias trabalhados</Label>
        <Input type="number" min="0" value={daysWorked} onChange={(e) => setDaysWorked(e.target.value)} required />
      </div>
      <div className="grid gap-2">
        <Label>Observação</Label>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex: Trabalha apenas meio período, Especialista em acabamento..."
          rows={3}
          className={cn(
            "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y min-h-[80px]"
          )}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Total pago = diária × dias (calculado automaticamente).
      </p>
      <DialogFooter className="gap-2 pt-2 sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </DialogFooter>
    </form>
  );
}
