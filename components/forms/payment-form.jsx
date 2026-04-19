"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
import { formatDateInput, getMonthName } from "@/lib/utils";
import { fetchCondominiumAmountForMonth } from "@/lib/api";
import { calculateTenantAmountDue } from "@/lib/tenant-billing";
import {
  DEFAULT_TENANT_PAYMENT_DAY,
  getDueDateForPeriod,
} from "@/lib/payment-dates";

function formatCurrencyInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const amount = Number(digits) / 100;
  return amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCurrencyFromNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCurrencyInput(value) {
  if (value == null || value === "") return 0;
  const normalized = String(value).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolvePaymentStatus({ amount, expectedAmount, dueDate }) {
  const paidAmount = Number(amount) || 0;
  const dueAmount = Number(expectedAmount) || 0;
  const today = new Date().toISOString().split("T")[0];

  if (paidAmount > 0 && dueAmount > 0 && paidAmount >= dueAmount) return "pago";
  if (paidAmount > 0) return "pendente";
  if ((dueDate || "") < today) return "atrasado";
  return "pendente";
}

export function PaymentForm({ payment, tenants, properties = [], onSave, onCancel, saving }) {
  const activeTenants = useMemo(
    () => (Array.isArray(tenants) ? tenants.filter((t) => t.status === "ativo") : []),
    [tenants]
  );
  const getTenantLabel = (t) => `${t.name || ""} — Kitnet ${t.kitnetNumber || "-"}`;
  const [tenantQuery, setTenantQuery] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [form, setForm] = useState({
    tenantId: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    expectedAmount: "",
    amount: "",
    dueDate: "",
    status: "pendente",
  });
  const [validationError, setValidationError] = useState(null);

  const selectedPropertyUnits = useMemo(() => {
    if (!selectedPropertyId) return [];
    const prop = properties.find((p) => String(p.id) === selectedPropertyId);
    return prop?.units || [];
  }, [selectedPropertyId, properties]);

  const lastSyncedPaymentId = useRef(null);
  useEffect(() => {
    const paymentId = payment?.id ?? null;
    const isNewPayment = paymentId !== lastSyncedPaymentId.current;
    lastSyncedPaymentId.current = paymentId;
    if (payment) {
      if (isNewPayment) {
        const expected = payment.expectedAmount != null ? payment.expectedAmount : payment.amount;
        const selectedTenant = activeTenants.find((t) => String(t.id) === String(payment.tenantId));
        setForm({
          tenantId: payment.tenantId || "",
          month: payment.month || new Date().getMonth() + 1,
          year: payment.year || new Date().getFullYear(),
          expectedAmount: expected != null ? formatCurrencyFromNumber(expected) : "",
          amount: payment.amount != null && payment.amount !== "" ? formatCurrencyFromNumber(payment.amount) : "",
          dueDate: formatDateInput(payment.dueDate) || "",
          status: resolvePaymentStatus({
            amount: payment.amount,
            expectedAmount: expected,
            dueDate: payment.dueDate,
          }),
        });
        setTenantQuery(selectedTenant ? getTenantLabel(selectedTenant) : "");
        if (selectedTenant?.propertyId) {
          setSelectedPropertyId(String(selectedTenant.propertyId));
        }
      }
    } else {
      const d = new Date();
      setForm({
        tenantId: "",
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        expectedAmount: "",
        amount: "",
        dueDate: getDueDateForPeriod(
          d.getMonth() + 1,
          d.getFullYear(),
          DEFAULT_TENANT_PAYMENT_DAY
        ),
        status: "pendente",
      });
      setTenantQuery("");
      setSelectedPropertyId("");
      setSelectedUnitId("");
    }
  }, [payment?.id, activeTenants]);

  const expectedNum = form.expectedAmount ? parseCurrencyInput(form.expectedAmount) : 0;
  const paidNum = form.amount !== "" ? parseCurrencyInput(form.amount) : null;

  useEffect(() => {
    if (payment?.id) return;

    const selectedTenant = activeTenants.find(
      (tenant) => String(tenant.id) === String(form.tenantId)
    );
    const nextDueDate = getDueDateForPeriod(
      form.month,
      form.year,
      selectedTenant?.paymentDay
    );

    setForm((currentForm) =>
      currentForm.dueDate === nextDueDate
        ? currentForm
        : { ...currentForm, dueDate: nextDueDate }
    );
  }, [payment?.id, form.tenantId, form.month, form.year, activeTenants]);

  useEffect(() => {
    if (payment?.id) return;
    if (!form.tenantId) {
      setForm((p) => ({ ...p, expectedAmount: "" }));
      return;
    }

    const t = activeTenants.find((x) => String(x.id) === String(form.tenantId));
    if (!t) return;

    let cancelled = false;
    const propertyId = selectedPropertyId || t.propertyId || "";

    (async () => {
      try {
        const condominiumValue = propertyId
          ? await fetchCondominiumAmountForMonth(form.month, form.year, propertyId)
          : 0;
        if (cancelled) return;
        const expected = calculateTenantAmountDue({
          rentValue: t.rentValue,
          condominiumValue,
        });
        setForm((p) => ({ ...p, expectedAmount: formatCurrencyFromNumber(expected) }));
      } catch {
        if (cancelled) return;
        setForm((p) => ({
          ...p,
          expectedAmount: formatCurrencyFromNumber(calculateTenantAmountDue({ rentValue: t.rentValue })),
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [payment?.id, form.tenantId, form.month, form.year, selectedPropertyId, activeTenants]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError(null);
    if (saving) return;
    const paid = form.amount !== "" ? parseCurrencyInput(form.amount) : 0;
    const expected =
      form.expectedAmount !== ""
        ? parseCurrencyInput(form.expectedAmount)
        : 0;
    
    if (paid < 0) {
      setValidationError("Valor pago não pode ser negativo.");
      return;
    }
    if (expected > 0 && paid > expected) {
      setValidationError("Valor pago não pode ser maior que o valor devido.");
      return;
    }
    if (expected === 0 && paid > 0) {
      setValidationError("Valor devido não foi calculado. Verifique o inquilino e período selecionados.");
      return;
    }
    // Valor devido = aluguel do inquilino + condomínio do imóvel no período
    const tenant = form.tenantId
      ? activeTenants.find((t) => String(t.id) === String(form.tenantId))
      : null;
    const expectedFromTenant =
      expected > 0
        ? expected
        : tenant && tenant.rentValue != null
          ? Number(tenant.rentValue)
          : 0;
    const resolvedStatus = resolvePaymentStatus({
      amount: paid,
      expectedAmount: expectedFromTenant,
      dueDate: form.dueDate,
    });
    const payload = {
      tenantId: form.tenantId,
      month: Number(form.month),
      year: Number(form.year),
      expectedAmount: expectedFromTenant,
      amount: Number(paid),
      dueDate: form.dueDate || null,
      status: resolvedStatus,
    };
    if (!payload.tenantId && !payment) {
      setValidationError("Selecione o inquilino.");
      return;
    }
    onSave(payload);
  };

  const handlePropertyChange = (v) => {
    const propId = v === "none" ? "" : v;
    setSelectedPropertyId(propId);
    setSelectedUnitId("");
  };

  const handleUnitChange = (v) => {
    if (v === "none") {
      setSelectedUnitId("");
      return;
    }
    setSelectedUnitId(v);
    const unit = selectedPropertyUnits.find((u) => u.id === v);
    if (!unit) return;
    if (unit.tenantId) {
      const tenant = activeTenants.find((t) => String(t.id) === String(unit.tenantId));
      if (tenant) {
        setForm((p) => ({
          ...p,
          tenantId: String(tenant.id),
          expectedAmount: tenant.rentValue != null ? formatCurrencyFromNumber(tenant.rentValue || 0) : p.expectedAmount,
        }));
        setTenantQuery(getTenantLabel(tenant));
      }
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: getMonthName(i + 1) }));
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4">
        {!payment && properties.length > 0 && (
          <div className="grid gap-4 rounded-lg border border-border/60 bg-muted/20 p-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Imóvel</Label>
              <Select
                value={selectedPropertyId || "none"}
                onValueChange={handlePropertyChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o imóvel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Todos —</SelectItem>
                  {properties.map((prop) => (
                    <SelectItem key={prop.id} value={String(prop.id)}>{prop.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Unidade</Label>
              <Select
                value={selectedUnitId || "none"}
                onValueChange={handleUnitChange}
                disabled={!selectedPropertyId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      !selectedPropertyId
                        ? "Selecione primeiro um imóvel"
                        : "Selecione a unidade"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhuma —</SelectItem>
                  {selectedPropertyUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.unitLabel || `Unidade ${u.id.slice(0, 6)}`}
                      {Array.isArray(u.residentNames) && u.residentNames.length > 0
                        ? ` (${u.residentNames.join(", ")})`
                        : u.residentName
                          ? ` (${u.residentName})`
                          : u.tenantName
                            ? ` (${u.tenantName})`
                            : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ao selecionar uma unidade, o responsavel financeiro vinculado e preenchido automaticamente.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <Label>Inquilino</Label>
          <Input
            list="payment-tenant-options"
            value={tenantQuery}
            onChange={(e) => {
              const query = e.target.value;
              setTenantQuery(query);
              const selected = activeTenants.find((t) => getTenantLabel(t) === query);
              if (!selected) {
                setForm((p) => ({ ...p, tenantId: "" }));
                return;
              }
              setForm((p) => ({
                ...p,
                tenantId: String(selected.id),
                amount:
                  !p.amount && selected.rentValue != null
                    ? formatCurrencyFromNumber(selected.rentValue || 0)
                    : p.amount,
              }));
              if (selected.propertyId) {
                setSelectedPropertyId(String(selected.propertyId));
              }
            }}
            placeholder="Digite para buscar inquilino..."
            disabled={!!payment}
          />
          <datalist id="payment-tenant-options">
            {activeTenants.map((t) => (
              <option key={t.id} value={getTenantLabel(t)} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">Campo pesquisavel: digite nome ou unidade e selecione apenas o responsavel financeiro.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Mês</Label>
            <Select
              value={String(form.month)}
              onValueChange={(v) => setForm((p) => ({ ...p, month: Number(v) }))}
              disabled={!!payment}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Ano</Label>
            <Select
              value={String(form.year)}
              onValueChange={(v) => setForm((p) => ({ ...p, year: Number(v) }))}
              disabled={!!payment}
            >
              <SelectTrigger>
                <SelectValue />
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
          <Label>Valor devido (R$)</Label>
          <Input
            type="text"
            value={form.expectedAmount}
            readOnly
            placeholder="0,00"
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">Valor do aluguel do inquilino (cadastro em Inquilinos).</p>
        </div>
        <div className="grid gap-2">
          <Label>Valor pago (R$)</Label>
          <Input
            type="text"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                amount: formatCurrencyInput(e.target.value),
              }))
            }
            placeholder="0,00"
            className={paidNum != null && expectedNum > 0 && paidNum > expectedNum ? "border-destructive" : ""}
          />
          <p className="text-xs text-muted-foreground">O que a pessoa já pagou. Se pagou menos que o devido, o restante fica pendente.</p>
          {expectedNum > 0 && (
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Máximo permitido: R$ {expectedNum.toFixed(2).replace(".", ",")}
            </p>
          )}
          {expectedNum > 0 && paidNum != null && paidNum < expectedNum && (
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Faltando (pendente): R$ {(expectedNum - paidNum).toFixed(2).replace(".", ",")}
            </p>
          )}
          {paidNum != null && expectedNum > 0 && paidNum > expectedNum && (
            <p className="text-xs font-medium text-destructive">
              ⚠️ Valor excede o devido em R$ {(paidNum - expectedNum).toFixed(2).replace(".", ",")}
            </p>
          )}
        </div>
        {validationError && (
          <p className="text-sm text-destructive">{validationError}</p>
        )}
        <div className="grid gap-2">
          <Label>Data de vencimento</Label>
          <Input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : payment ? "Salvar" : "Registrar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
