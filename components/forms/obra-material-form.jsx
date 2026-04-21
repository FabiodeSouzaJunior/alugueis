"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { formatDateInput } from "@/lib/utils";

const UNITS = ["un", "m", "m²", "m³", "kg", "L", "cx", "pc", "sc"];

export function ObraMaterialForm({ material, onSave, onCancel, saving }) {
  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("un");
  const [unitPrice, setUnitPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");

  useEffect(() => {
    if (material) {
      setMaterialName(material.materialName ?? "");
      setQuantity(material.quantity != null ? String(material.quantity) : "");
      setUnit(material.unit || "un");
      setUnitPrice(material.unitPrice != null ? String(material.unitPrice) : "");
      setSupplier(material.supplier ?? "");
      setPurchaseDate(material.purchaseDate ? formatDateInput(material.purchaseDate) : "");
    } else {
      setMaterialName("");
      setQuantity("");
      setUnit("un");
      setUnitPrice("");
      setSupplier("");
      setPurchaseDate("");
    }
  }, [material]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = quantity !== "" && !isNaN(Number(quantity)) ? Number(quantity) : 0;
    const p = unitPrice !== "" && !isNaN(Number(unitPrice)) ? Number(unitPrice) : 0;
    onSave({
      materialName: materialName.trim() || "Material",
      quantity: q,
      unit,
      unitPrice: p,
      supplier: supplier.trim() || null,
      purchaseDate: purchaseDate || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label>Material</Label>
        <Input value={materialName} onChange={(e) => setMaterialName(e.target.value)} placeholder="Nome do material" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Quantidade</Label>
          <Input type="number" step="0.001" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label>Unidade</Label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Preço unitário (R$)</Label>
        <Input type="number" step="0.01" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required />
      </div>
      <div className="grid gap-2">
        <Label>Fornecedor</Label>
        <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Opcional" />
      </div>
      <div className="grid gap-2">
        <Label>Data da compra</Label>
        <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
      </div>
      <DialogFooter className="gap-2 pt-2 sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </DialogFooter>
    </form>
  );
}
