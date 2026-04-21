"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { Pencil, Trash2, Plus, UserPlus, Check, X } from "lucide-react";
import {
  createPropertyUnit,
  updatePropertyUnit,
  deletePropertyUnit,
} from "@/lib/api";

const emptyUnitForm = { unitLabel: "", rentPrice: "", maxPeople: "" };
const emptyResidentForm = { tenantId: "", residentTenantId: "" };

export function PropertyUnitsSection({
  propertyId,
  units = [],
  tenantsInProperty = [],
  onUpdate,
  initialEditUnitId,
  initialAdding = false,
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [registeringId, setRegisteringId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState(emptyUnitForm);
  const [residentForm, setResidentForm] = useState(emptyResidentForm);

  useEffect(() => {
    if (initialEditUnitId && units.length > 0) {
      const unit = units.find((u) => u.id === initialEditUnitId);
      if (unit) {
        setEditingId(unit.id);
        setForm({
          unitLabel: unit.unitLabel || "",
          rentPrice: unit.rentPrice != null ? String(unit.rentPrice) : "",
          maxPeople: unit.maxPeople != null ? String(unit.maxPeople) : "",
        });
      }
    }
  }, [initialEditUnitId, units]);

  useEffect(() => {
    if (!initialAdding) return;
    setAdding(true);
    setEditingId(null);
    setRegisteringId(null);
    setForm(emptyUnitForm);
  }, [initialAdding, propertyId]);

  const handleAdd = async () => {
    if (!propertyId) return;
    setErrorMsg("");
    setSaving(true);
    try {
      const rentPrice = form.rentPrice.trim() !== "" ? Number(String(form.rentPrice).replace(",", ".")) : null;
      const maxPeople = form.maxPeople.trim() !== "" ? Math.max(0, parseInt(form.maxPeople, 10) || 0) : null;
      await createPropertyUnit(propertyId, {
        unitLabel: form.unitLabel?.trim() || null,
        rentPrice,
        maxPeople,
      });
      setForm(emptyUnitForm);
      setAdding(false);
      onUpdate?.();
    } catch (e) {
      console.error(e);
      setErrorMsg(e?.message || "Erro ao registrar unidade.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (unit) => {
    if (!propertyId || !unit.id) return;
    setErrorMsg("");
    setSaving(true);
    try {
      const rentPrice = form.rentPrice.trim() !== "" ? Number(String(form.rentPrice).replace(",", ".")) : null;
      const maxPeople = form.maxPeople.trim() !== "" ? Math.max(0, parseInt(form.maxPeople, 10) || 0) : null;
      await updatePropertyUnit(propertyId, unit.id, {
        unitLabel: form.unitLabel?.trim() || null,
        rentPrice,
        maxPeople,
      });
      setEditingId(null);
      setForm(emptyUnitForm);
      onUpdate?.();
    } catch (e) {
      console.error(e);
      setErrorMsg(e?.message || "Erro ao salvar unidade.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveResidents = async (unit) => {
    if (!propertyId || !unit.id) return;
    setErrorMsg("");
    setSaving(true);
    try {
      await updatePropertyUnit(propertyId, unit.id, {
        tenantId: residentForm.tenantId || null,
        residentTenantId: residentForm.residentTenantId || null,
      });
      setRegisteringId(null);
      setResidentForm(emptyResidentForm);
      onUpdate?.();
    } catch (e) {
      console.error(e);
      setErrorMsg(e?.message || "Erro ao registrar moradores da unidade.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (unitId) => {
    if (!propertyId || !unitId) return;
    if (!confirm("Excluir esta unidade?")) return;
    setSaving(true);
    try {
      await deletePropertyUnit(propertyId, unitId);
      onUpdate?.();
    } catch (e) {
      console.error(e);
      setErrorMsg(e?.message || "Erro ao excluir unidade.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (unit) => {
    setEditingId(unit.id);
    setRegisteringId(null);
    setForm({
      unitLabel: unit.unitLabel || "",
      rentPrice: unit.rentPrice != null ? String(unit.rentPrice) : "",
      maxPeople: unit.maxPeople != null ? String(unit.maxPeople) : "",
    });
  };

  const startRegistering = (unit) => {
    setRegisteringId(unit.id);
    setEditingId(null);
    setResidentForm({
      tenantId: unit.tenantId || "",
      residentTenantId: unit.residentTenantId || "",
    });
  };

  return (
    <div className="space-y-3 border-t pt-4 mt-4">
      <h3 className="text-sm font-medium text-foreground">Unidades / registros deste imóvel</h3>
      {errorMsg ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMsg}</p>
      ) : null}

      {(units.length > 0 || adding) && (
        <div className="overflow-visible rounded-md border border-border">
          <Table mobileCards className="min-w-[600px] text-sm">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-28">Identificador</TableHead>
                <TableHead className="w-32 tabular-nums">Aluguel</TableHead>
                <TableHead className="w-24">Máx. pessoas</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Quem mora</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((u) => (
                <>
                  <TableRow key={u.id}>
                    {editingId === u.id ? (
                      <>
                        <TableCell data-label="Identificador">
                          <Input placeholder="Ex: 101" value={form.unitLabel} onChange={(e) => setForm((p) => ({ ...p, unitLabel: e.target.value }))} className="h-8 w-full sm:w-24" />
                        </TableCell>
                        <TableCell data-label="Aluguel">
                          <Input type="number" min={0} step="0.01" placeholder="0,00" value={form.rentPrice} onChange={(e) => setForm((p) => ({ ...p, rentPrice: e.target.value }))} className="h-8 w-full sm:w-28" />
                        </TableCell>
                        <TableCell data-label="Max. pessoas">
                          <Input type="number" min={0} placeholder="0" value={form.maxPeople} onChange={(e) => setForm((p) => ({ ...p, maxPeople: e.target.value }))} className="h-8 w-full sm:w-20" />
                        </TableCell>
                        <TableCell data-mobile-hidden="true" colSpan={2} />
                        <TableCell data-mobile-actions="true" className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button type="button" size="icon" className="h-7 w-7" onClick={() => handleEdit(u)} disabled={saving} title="Salvar">
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(null); setForm(emptyUnitForm); }} title="Cancelar">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell data-mobile-primary="true" className="font-medium">{u.unitLabel || "—"}</TableCell>
                        <TableCell data-label="Aluguel" className="tabular-nums">{u.rentPrice != null ? formatCurrency(u.rentPrice) : "—"}</TableCell>
                        <TableCell data-label="Max. pessoas">{u.maxPeople != null ? u.maxPeople : "—"}</TableCell>
                        <TableCell data-label="Responsavel">{u.tenantName || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell data-label="Quem mora">{u.residentName || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell data-mobile-actions="true" className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title="Registrar responsável / quem mora" onClick={() => startRegistering(u)}>
                              <UserPlus className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={() => startEdit(u)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" title="Excluir" onClick={() => handleDelete(u.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>

                  {registeringId === u.id && (
                    <TableRow key={`${u.id}-registering`} data-mobile-detail="true" className="bg-muted/30 hover:bg-muted/30">
                      <TableCell data-mobile-full="true" colSpan={6} className="pb-3 pt-2">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Registrar responsável e quem mora — {u.unitLabel || "esta unidade"}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Select value={residentForm.tenantId || "none"} onValueChange={(v) => setResidentForm((p) => ({ ...p, tenantId: v === "none" ? "" : v }))}>
                              <SelectTrigger className="h-8 w-full sm:w-[200px]">
                                <SelectValue placeholder="Responsável pelo pagamento" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— Nenhum —</SelectItem>
                                {tenantsInProperty.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={residentForm.residentTenantId || "none"} onValueChange={(v) => setResidentForm((p) => ({ ...p, residentTenantId: v === "none" ? "" : v }))}>
                              <SelectTrigger className="h-8 w-full sm:w-[200px]">
                                <SelectValue placeholder="Quem mora na unidade" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— Nenhum —</SelectItem>
                                {tenantsInProperty.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button type="button" size="sm" onClick={() => handleSaveResidents(u)} disabled={saving}>
                              <Check className="mr-1 h-3.5 w-3.5" /> Salvar
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => { setRegisteringId(null); setResidentForm(emptyResidentForm); }}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}

              {adding && (
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableCell data-label="Identificador">
                    <Input placeholder="Ex: 101" value={form.unitLabel} onChange={(e) => setForm((p) => ({ ...p, unitLabel: e.target.value }))} className="h-8 w-full sm:w-24" />
                  </TableCell>
                  <TableCell data-label="Aluguel">
                    <Input type="number" min={0} step="0.01" placeholder="0,00" value={form.rentPrice} onChange={(e) => setForm((p) => ({ ...p, rentPrice: e.target.value }))} className="h-8 w-full sm:w-28" />
                  </TableCell>
                  <TableCell data-label="Max. pessoas">
                    <Input type="number" min={0} placeholder="0" value={form.maxPeople} onChange={(e) => setForm((p) => ({ ...p, maxPeople: e.target.value }))} className="h-8 w-full sm:w-20" />
                  </TableCell>
                  <TableCell data-mobile-full="true" colSpan={2} className="text-xs text-muted-foreground italic">
                    Responsável e morador podem ser registrados após salvar.
                  </TableCell>
                  <TableCell data-mobile-actions="true" className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button type="button" size="icon" className="h-7 w-7" onClick={handleAdd} disabled={saving} title="Registrar unidade">
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setAdding(false); setForm(emptyUnitForm); }} title="Cancelar">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {units.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">
          Nenhuma unidade. Clique em &quot;Adicionar unidade&quot; para cadastrar.
        </p>
      )}

      {!adding && (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar unidade
        </Button>
      )}
    </div>
  );
}
