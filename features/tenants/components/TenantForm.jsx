"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertCircle } from "lucide-react";

import { useTenantForm } from "../hooks/useTenantForm";
import { useTenantContract } from "../hooks/useTenantContract";
import { ContractUpload } from "./ContractUpload";

function FieldError({ message, tone = "error" }) {
  if (!message) return null;
  const className =
    tone === "warning"
      ? "text-xs text-amber-700 dark:text-amber-300"
      : "text-xs text-destructive";
  return <p className={className}>{message}</p>;
}

function RequiredLabel({ htmlFor, children }) {
  return (
    <Label htmlFor={htmlFor}>
      {children} <span className="text-destructive">*</span>
    </Label>
  );
}

export function TenantForm({
  tenant,
  properties = [],
  onSave,
  onCancel,
  initialValues = {},
  lockedFields = {},
  submitLabel,
  submitting = false,
}) {
  const {
    form,
    errors,
    units,
    loadingUnits,
    setFieldValue,
    handleRentChange,
    handlePropertyChange,
    handleUnitChange,
    handlePaymentResponsibleChange,
    handleIptuChange,
    iptuMonthlyValue,
    computedRentWithIptu,
    submit,
  } = useTenantForm({ tenant, initialValues });

  const {
    existingContract,
    selectedFile,
    uploading: contractUploading,
    error: contractError,
    handleFileSelect,
    handleFileRemove,
    uploadContract,
    removeContract,
  } = useTenantContract(tenant?.id, tenant);

  const errorSummaryRef = useRef(null);

  const errorMessages = Object.values(errors);

  useEffect(() => {
    if (errorMessages.length > 0 && errorSummaryRef.current) {
      errorSummaryRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [errorMessages.length]);

  async function handleSave(payload) {
    // Attach contract file and removal flag to payload for the parent to handle
    if (form.isPaymentResponsible && selectedFile) {
      payload.__contractFile = selectedFile;
    }

    // Flag for contract removal: had existing, user removed it
    if (form.isPaymentResponsible && !selectedFile && !existingContract && tenant?.id) {
      payload.__contractRemoved = true;
    }

    return onSave(payload);
  }

  function handleSubmit(event) {
    submit(event, handleSave);
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-1 py-1 sm:px-1">
        {errorMessages.length > 0 ? (
          <div
            ref={errorSummaryRef}
            className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">Corrija os seguintes campos para continuar:</p>
              <ul className="list-disc pl-4 text-sm text-destructive/90">
                {errorMessages.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
        <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="mb-4 space-y-1">
            <h3 className="text-base font-semibold tracking-tight">Dados principais</h3>
            <p className="text-sm text-muted-foreground">
              Preencha os dados obrigatorios do inquilino para manter o cadastro consistente.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="grid gap-2">
              <RequiredLabel htmlFor="tenant-name">Nome completo</RequiredLabel>
              <Input
                id="tenant-name"
                value={form.name}
                onChange={(event) => setFieldValue("name", event.target.value)}
                placeholder="Nome completo"
                aria-invalid={!!errors.name}
                required
              />
              <FieldError message={errors.name} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tenant-phone">
                Telefone
                {form.isPaymentResponsible ? (
                  <span className="text-destructive"> *</span>
                ) : null}
              </Label>
              <Input
                id="tenant-phone"
                value={form.phone}
                onChange={(event) => setFieldValue("phone", event.target.value)}
                placeholder="(00) 00000-0000"
                inputMode="tel"
                aria-invalid={!!errors.phone}
                required={form.isPaymentResponsible}
              />
              <FieldError message={errors.phone} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="tenant-document">CPF / Documento</Label>
              <Input
                id="tenant-document"
                value={form.documentNumber}
                onChange={(event) => setFieldValue("documentNumber", event.target.value)}
                placeholder="CPF ou documento"
                aria-invalid={!!errors.documentNumber}
              />
              <FieldError message={errors.documentNumber} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tenant-email">
                Email
                {form.isPaymentResponsible ? (
                  <span className="text-destructive"> *</span>
                ) : null}
              </Label>
              <Input
                id="tenant-email"
                type="email"
                inputMode="email"
                value={form.email}
                onChange={(event) => setFieldValue("email", event.target.value)}
                placeholder="nome@exemplo.com"
                aria-invalid={!!errors.email}
                required={form.isPaymentResponsible}
              />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Obrigatorio para marcar este inquilino como responsavel pelo pagamento.
              </p>
              <FieldError message={errors.email} tone="warning" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-muted/20 p-5">
          <div className="mb-4 space-y-1">
            <h3 className="text-base font-semibold tracking-tight">Pagamento e vinculos</h3>
            <p className="text-sm text-muted-foreground">
              Defina o responsavel pelo pagamento e a unidade associada ao cadastro.
            </p>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Responsavel pelo pagamento</p>
              <p className="text-xs text-muted-foreground">
                O email precisa estar preenchido antes de ativar esta opcao.
              </p>
            </div>
            <Switch
              checked={!!form.isPaymentResponsible}
              onCheckedChange={handlePaymentResponsibleChange}
              aria-label="Responsavel pelo pagamento"
            />
          </div>

          {form.isPaymentResponsible ? (
            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
              Este cadastro sera sincronizado automaticamente com a unidade e com a pagina de Imoveis.
            </div>
          ) : null}

          {form.isPaymentResponsible || existingContract ? (
            <div className="mt-4">
              <ContractUpload
                existingContract={existingContract}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                onFileRemove={async () => {
                  if (existingContract && tenant?.id) {
                    await removeContract(tenant.id);
                  }
                  handleFileRemove();
                }}
                uploading={contractUploading}
                error={contractError}
              />
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="mb-4 space-y-1">
            <h3 className="text-base font-semibold tracking-tight">Imovel e contrato</h3>
            <p className="text-sm text-muted-foreground">
              Vincule o inquilino ao imovel correto e complemente as informacoes do contrato.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="grid gap-2">
              <Label>Imovel{form.isPaymentResponsible ? " *" : ""}</Label>
              <Select
                value={form.propertyId && String(form.propertyId).trim() ? String(form.propertyId) : "none"}
                onValueChange={handlePropertyChange}
                disabled={!!lockedFields.propertyId}
              >
                <SelectTrigger className="w-full" aria-invalid={!!errors.propertyId}>
                  <SelectValue placeholder="Selecione o imovel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Nenhum --</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={String(property.id)}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.propertyId} />
            </div>

            <div className="grid gap-2">
              <Label>Unidade</Label>
              <Select
                value={form.unitId || "none"}
                onValueChange={handleUnitChange}
                disabled={!form.propertyId || loadingUnits || !!lockedFields.unitId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      !form.propertyId
                        ? "Selecione primeiro um imovel"
                        : loadingUnits
                          ? "Carregando unidades..."
                          : "Selecione a unidade"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Nenhuma --</SelectItem>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.unitLabel || `Unidade ${unit.id.slice(0, 6)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.propertyId && units.length === 0 && !loadingUnits ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Nenhuma unidade cadastrada neste imovel. Cadastre unidades na pagina de Imoveis.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {form.isPaymentResponsible ? (
              <div className="grid gap-2">
                <Label htmlFor="tenant-rent-value">Valor do aluguel (R$)</Label>
                <Input
                  id="tenant-rent-value"
                  value={form.rentValue}
                  onChange={(event) => handleRentChange(event.target.value)}
                  placeholder="0,00"
                  inputMode="numeric"
                />
              </div>
            ) : null}

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tenant-start-date">Data de entrada</Label>
                <Input
                  id="tenant-start-date"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setFieldValue("startDate", event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tenant-payment-day">Dia do pagamento</Label>
                <Input
                  id="tenant-payment-day"
                  type="number"
                  min={1}
                  max={31}
                  step={1}
                  value={form.paymentDay}
                  onChange={(event) => setFieldValue("paymentDay", event.target.value)}
                  placeholder="Ex: 10"
                  aria-invalid={!!errors.paymentDay}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use 31 para considerar automaticamente o ultimo dia dos meses menores.
                </p>
                <FieldError message={errors.paymentDay} />
              </div>
            </div>
          </div>

          {form.isPaymentResponsible ? (
            <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold tracking-tight">IPTU</h4>
                <p className="text-xs text-muted-foreground">
                  Informe o valor total anual do IPTU. Ele sera dividido em parcelas e somado automaticamente ao aluguel mensal.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="tenant-iptu-value">Valor total do IPTU (R$)</Label>
                  <Input
                    id="tenant-iptu-value"
                    value={form.iptuValue}
                    onChange={(event) => handleIptuChange(event.target.value)}
                    placeholder="0,00"
                    inputMode="numeric"
                  />
                </div>

                {form.iptuValue ? (
                  <div className="grid gap-2">
                    <Label htmlFor="tenant-iptu-installments">Parcelas</Label>
                    <Select
                      value={form.iptuInstallments}
                      onValueChange={(value) => setFieldValue("iptuInstallments", value)}
                    >
                      <SelectTrigger id="tenant-iptu-installments" className="w-full">
                        <SelectValue placeholder="Parcelas" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}x
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>

              {iptuMonthlyValue > 0 ? (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>IPTU mensal ({form.iptuInstallments}x)</span>
                    <span className="font-medium text-foreground">
                      R$ {iptuMonthlyValue.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-semibold text-emerald-800 dark:text-emerald-200">
                    <span>Valor total cobrado/mes</span>
                    <span>R$ {computedRentWithIptu.toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setFieldValue("status", value)}>
                <SelectTrigger aria-invalid={!!errors.status}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="saiu">Saiu</SelectItem>
                </SelectContent>
              </Select>
              <FieldError message={errors.status} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tenant-observacao">Observacoes</Label>
              <textarea
                id="tenant-observacao"
                value={form.observacao}
                onChange={(event) => setFieldValue("observacao", event.target.value)}
                placeholder="Anotacoes sobre o inquilino..."
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                rows={5}
              />
            </div>
          </div>
        </section>
      </div>

      <DialogFooter className="mt-6 border-t border-border bg-background px-1 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || contractUploading}>
          {submitLabel || (tenant ? "Salvar" : "Adicionar")}
        </Button>
      </DialogFooter>
    </form>
  );
}
