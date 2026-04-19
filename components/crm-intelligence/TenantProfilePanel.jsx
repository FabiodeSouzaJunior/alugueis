"use client";

import { useCallback, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContentWithClose,
} from "@/components/ui/dialog";
import { formatDate, formatCurrency } from "@/lib/utils";
import { getPaymentStatus, getPendingAmount } from "@/lib/calculations";
import {
  fetchTenantInteractions,
  fetchTenantSatisfaction,
  fetchTenantFeedback,
  createTenantInteraction,
  createTenantExit,
} from "@/lib/api";
import { User, Home, Calendar, Star, MessageSquare, LogOut } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const INTERACTION_TYPES = [
  "Entrada no imóvel",
  "Reclamação",
  "Manutenção solicitada",
  "Renovação de contrato",
  "Contato geral",
  "Outro",
];

const EXIT_REASONS = [
  { value: "mudanca_cidade", label: "Mudança de cidade" },
  { value: "preco_alto", label: "Preço alto" },
  { value: "problemas_estrutura", label: "Problemas na estrutura" },
  { value: "mudanca_trabalho", label: "Mudança de trabalho" },
  { value: "outro", label: "Outro" },
];

export function TenantProfilePanel({
  tenant,
  payments = [],
  satisfactionList = [],
  feedbackList = [],
  interactionsList = [],
  onClose,
  onRefresh,
}) {
  const [interactionType, setInteractionType] = useState("");
  const [interactionDesc, setInteractionDesc] = useState("");
  const [exitReason, setExitReason] = useState("");
  const [exitNotes, setExitNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const overdueCount = payments.filter((p) => getPaymentStatus(p) === "atrasado").length;
  const totalPending = payments.reduce((s, p) => s + getPendingAmount(p), 0);
  const lastSatisfaction = satisfactionList[0];
  const avgOverall = lastSatisfaction?.overall;
  const tenureMonths = tenant?.startDate
    ? Math.max(0, Math.floor((Date.now() - new Date(tenant.startDate).getTime()) / (30 * 24 * 60 * 60 * 1000)))
    : null;

  const handleAddInteraction = useCallback(async () => {
    if (!tenant?.id || !interactionType) return;
    setError(null);
    setSaving(true);
    try {
      await createTenantInteraction({
        tenantId: tenant.id,
        type: interactionType,
        description: interactionDesc.trim() || null,
      });
      setInteractionType("");
      setInteractionDesc("");
      onRefresh?.();
    } catch (e) {
      setError(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }, [tenant?.id, interactionType, interactionDesc, onRefresh]);

  const handleRegisterExit = useCallback(async () => {
    if (!tenant?.id || !exitReason) return;
    setError(null);
    setSaving(true);
    try {
      await createTenantExit({
        tenantId: tenant.id,
        reasonCode: exitReason,
        notes: exitNotes.trim() || null,
        exitDate: new Date().toISOString().split("T")[0],
      });
      onRefresh?.();
      onClose?.();
    } catch (e) {
      setError(e?.message || "Erro ao registrar saída");
    } finally {
      setSaving(false);
    }
  }, [tenant?.id, exitReason, exitNotes, onRefresh, onClose]);

  const timeline = [
    ...interactionsList.map((i) => ({
      type: "interaction",
      date: i.occurredAt,
      label: i.type,
      desc: i.description,
    })),
    ...feedbackList.map((f) => ({
      type: "feedback",
      date: f.createdAt,
      label: "Feedback: " + (f.category || "Geral"),
      desc: f.comment,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!tenant) return null;

  return (
    <Dialog open={!!tenant} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContentWithClose
        title={`Perfil – ${tenant.name}`}
        onClose={onClose}
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
      >
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Dados do inquilino
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Nome:</strong> {tenant.name}</p>
              <p><strong>Telefone:</strong> {tenant.phone || "–"}</p>
              <p><strong>E-mail:</strong> {tenant.email || "–"}</p>
              <p><strong>Kitnet:</strong> {tenant.kitnetNumber || "–"}</p>
              <p><strong>Aluguel:</strong> {formatCurrency(tenant.rentValue)}</p>
              <p><strong>Entrada:</strong> {tenant.startDate ? formatDate(tenant.startDate) : "–"}</p>
              <p><strong>Tempo de permanência:</strong>{" "}
                {tenureMonths != null ? `${tenureMonths} meses` : "–"}
              </p>
              {avgOverall != null && (
                <p className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-amber-500" />
                  <strong>Satisfação (última):</strong> {avgOverall}/5
                </p>
              )}
              {overdueCount > 0 && (
                <p className="text-destructive">
                  <strong>Pagamentos em atraso:</strong> {overdueCount} (total pendente: {formatCurrency(totalPending)})
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Linha do tempo</CardTitle>
              <CardDescription>Histórico de interações e feedback</CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
              ) : (
                <ul className="space-y-3">
                  {timeline.slice(0, 15).map((t, i) => (
                    <li key={i} className="border-l-2 border-primary/30 pl-4 py-1">
                      <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                      <p className="font-medium">{t.label}</p>
                      {t.desc && <p className="text-sm text-muted-foreground">{t.desc}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {tenant.status === "ativo" && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Registrar interação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Select value={interactionType || "__none__"} onValueChange={(v) => setInteractionType(v === "__none__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Tipo</SelectItem>
                      {INTERACTION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Descrição (opcional)"
                    value={interactionDesc}
                    onChange={(e) => setInteractionDesc(e.target.value)}
                  />
                  <Button size="sm" onClick={handleAddInteraction} disabled={saving || !interactionType}>
                    Adicionar
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <LogOut className="h-4 w-4" />
                    Registrar saída
                  </CardTitle>
                  <CardDescription>Encerra o contrato e marca o inquilino como inativo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Select value={exitReason || "__none__"} onValueChange={(v) => setExitReason(v === "__none__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Motivo da saída" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Motivo</SelectItem>
                      {EXIT_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Observações (opcional)"
                    value={exitNotes}
                    onChange={(e) => setExitNotes(e.target.value)}
                  />
                  <Button variant="destructive" size="sm" onClick={handleRegisterExit} disabled={saving || !exitReason}>
                    Registrar saída
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </DialogContentWithClose>
    </Dialog>
  );
}
