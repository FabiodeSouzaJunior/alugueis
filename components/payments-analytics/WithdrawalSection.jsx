"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, cn } from "@/lib/utils";
import {
  createOwnerPayoutMethod,
  createOwnerWithdrawal,
  fetchOwnerWallet,
  fetchOwnerWalletLedger,
  fetchOwnerWithdrawals,
} from "@/lib/api";
import {
  ArrowDownToLine,
  CircleAlert,
  Clock3,
  Loader2,
  Lock,
  ShieldCheck,
  Wallet,
} from "lucide-react";

const STATUS_CONFIG = {
  requested: {
    label: "Solicitado",
    icon: Clock3,
    className: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  },
  reserved: {
    label: "Reservado",
    icon: Lock,
    className: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  },
  processing: {
    label: "Processando",
    icon: Loader2,
    className: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  },
  provider_pending: {
    label: "Aguardando banco",
    icon: Clock3,
    className: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
  },
  queued_manual_settlement: {
    label: "Em conciliacao",
    icon: Clock3,
    className: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  },
  succeeded: {
    label: "Concluido",
    icon: ShieldCheck,
    className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  },
  failed: {
    label: "Falhou",
    icon: CircleAlert,
    className: "bg-red-500/15 text-red-700 border-red-500/30",
  },
  cancelled: {
    label: "Cancelado",
    icon: CircleAlert,
    className: "bg-zinc-500/15 text-zinc-700 border-zinc-500/30",
  },
};

const LEDGER_LABELS = {
  payment_credit: "Credito de aluguel",
  gateway_fee_debit: "Taxa do gateway",
  platform_fee_debit: "Taxa da plataforma",
  withdrawal_reservation: "Reserva de saque",
  withdrawal_reservation_release: "Liberacao da reserva",
  withdrawal_debit: "Debito de saque",
  refund_debit: "Estorno",
  chargeback_debit: "Chargeback",
  dispute_hold: "Bloqueio por disputa",
  dispute_release: "Liberacao de disputa",
  manual_adjustment_credit: "Ajuste manual a credito",
  manual_adjustment_debit: "Ajuste manual a debito",
};

const PIX_KEY_TYPES = [
  { value: "CPF", label: "CPF" },
  { value: "CNPJ", label: "CNPJ" },
  { value: "EMAIL", label: "E-mail" },
  { value: "PHONE", label: "Telefone" },
  { value: "RANDOM", label: "Chave aleatoria" },
];
const WITHDRAWAL_FEE = 0.8;
const WITHDRAWAL_HISTORY_LIMIT = 8;
const INITIAL_LEDGER_LIMIT = 10;
const EXPANDED_LEDGER_LIMIT = 30;

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseMoneyInput(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatOwnerMethodLabel(method, ownerNameById) {
  const ownerLabel = ownerNameById[method.ownerId] || "Proprietario";
  return `${ownerLabel} - PIX ${method.pixKeyMasked}`;
}

function withTimeout(promise, timeoutMs = 15000, label = "request") {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`Tempo limite excedido ao carregar ${label}.`));
      }, timeoutMs);
    }),
  ]);
}

export function WithdrawalSection() {
  const [wallet, setWallet] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [ledgerItems, setLedgerItems] = useState([]);
  const [ledgerLimit, setLedgerLimit] = useState(INITIAL_LEDGER_LIMIT);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selectedPayoutMethodId, setSelectedPayoutMethodId] = useState("");
  const [payoutOwnerId, setPayoutOwnerId] = useState("");
  const [pixKeyType, setPixKeyType] = useState("CPF");
  const [pixKeyValue, setPixKeyValue] = useState("");
  const [holderName, setHolderName] = useState("");
  const [holderTaxId, setHolderTaxId] = useState("");
  const [creatingPayoutMethod, setCreatingPayoutMethod] = useState(false);

  const ownerNameById = useMemo(() => {
    const entries = (wallet?.owners || []).map((owner) => [owner.id, owner.displayName || owner.id]);
    return Object.fromEntries(entries);
  }, [wallet]);

  async function loadData({ keepMessages = false, nextLedgerLimit = ledgerLimit } = {}) {
    try {
      setLoading(true);
      if (!keepMessages) {
        setError(null);
        setSuccess(null);
      }

      const [walletResult, withdrawalsResult, ledgerResult] = await Promise.allSettled([
        withTimeout(fetchOwnerWallet(), 15000, "a carteira"),
        withTimeout(
          fetchOwnerWithdrawals({ limit: WITHDRAWAL_HISTORY_LIMIT, offset: 0 }),
          15000,
          "o historico de saques"
        ),
        withTimeout(
          fetchOwnerWalletLedger({ limit: nextLedgerLimit, offset: 0 }),
          15000,
          "o razao financeiro"
        ),
      ]);

      const walletData = walletResult.status === "fulfilled" ? walletResult.value : null;
      const withdrawalsData =
        withdrawalsResult.status === "fulfilled" ? withdrawalsResult.value : { items: [] };
      const ledgerData = ledgerResult.status === "fulfilled" ? ledgerResult.value : { items: [] };

      setWallet(walletData || null);
      setWithdrawals(Array.isArray(withdrawalsData?.items) ? withdrawalsData.items : []);
      setLedgerItems(Array.isArray(ledgerData?.items) ? ledgerData.items : []);

      const verifiedMethods = (walletData?.payoutMethods || []).filter(
        (method) => method.verificationStatus === "verified" && method.active
      );
      const defaultMethod =
        verifiedMethods.find((method) => method.isDefault) ||
        verifiedMethods[0] ||
        null;

      setSelectedPayoutMethodId((current) => {
        if (current && verifiedMethods.some((method) => method.id === current)) {
          return current;
        }
        return defaultMethod?.id || "";
      });
      setPayoutOwnerId((current) => {
        if (current && (walletData?.owners || []).some((owner) => owner.id === current)) {
          return current;
        }
        return walletData?.owners?.[0]?.id || "";
      });

      const failedMessages = [
        walletResult.status === "rejected" ? walletResult.reason?.message : null,
        withdrawalsResult.status === "rejected" ? withdrawalsResult.reason?.message : null,
        ledgerResult.status === "rejected" ? ledgerResult.reason?.message : null,
      ].filter(Boolean);

      if (failedMessages.length > 0) {
        setError(failedMessages[0] || "Nao foi possivel carregar a carteira de saque.");
      }
    } catch (loadError) {
      console.error(loadError);
      setError(loadError?.message || "Nao foi possivel carregar a carteira de saque.");
      setWallet(null);
      setWithdrawals([]);
      setLedgerItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleShowOlderLedgerItems() {
    setLedgerLimit(EXPANDED_LEDGER_LIMIT);
    loadData({ keepMessages: true, nextLedgerLimit: EXPANDED_LEDGER_LIMIT });
  }

  const balances = wallet?.balances || {
    available: 0,
    availableCents: 0,
    pending: 0,
    pendingCents: 0,
    reserved: 0,
    reservedCents: 0,
    blocked: 0,
    blockedCents: 0,
    gross: 0,
    grossCents: 0,
  };

  const verifiedPayoutMethods = (wallet?.payoutMethods || []).filter(
    (method) => method.verificationStatus === "verified" && method.active
  );
  const visibleLedgerItems = useMemo(
    () =>
      ledgerItems
        .filter((entry) => entry.entryType !== "gateway_fee_debit")
        .sort((left, right) => {
          const leftTime = new Date(left.createdAt || 0).getTime();
          const rightTime = new Date(right.createdAt || 0).getTime();
          return rightTime - leftTime;
        }),
    [ledgerItems]
  );
  const parsedAmount = parseMoneyInput(amount);
  const estimatedNetAmount = Math.max(parsedAmount - WITHDRAWAL_FEE, 0);
  const hasEnoughBalance = parsedAmount > 0 && parsedAmount <= (balances.available || 0);
  const canSubmit =
    !loading &&
    !submitting &&
    verifiedPayoutMethods.length > 0 &&
    selectedPayoutMethodId &&
    parsedAmount >= (wallet?.minimumWithdrawal || 0) &&
    hasEnoughBalance;

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedPayoutMethodId) {
      setError("Selecione um metodo PIX verificado.");
      return;
    }

    if (parsedAmount < (wallet?.minimumWithdrawal || 0)) {
      setError(
        `O valor minimo para saque e ${formatCurrency(wallet?.minimumWithdrawal || 0)}.`
      );
      return;
    }

    if (!hasEnoughBalance) {
      setError("Saldo disponivel insuficiente para o valor solicitado.");
      return;
    }

    setSubmitting(true);
    try {
      const idempotencyKey =
        globalThis.crypto?.randomUUID?.() ||
        `owner-withdrawal-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const result = await createOwnerWithdrawal({
        payoutMethodId: selectedPayoutMethodId,
        amount: parsedAmount,
        idempotencyKey,
        note: note.trim() || null,
      });

      setSuccess("Saque solicitado com sucesso. O saldo foi reservado e o PIX entrou em conciliacao automatica.");
      setAmount("");
      setNote("");
      if (result?.wallet) setWallet(result.wallet);
      await loadData({ keepMessages: true });
    } catch (submitError) {
      setError(submitError?.message || "Nao foi possivel solicitar o saque.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreatePayoutMethod(event) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!payoutOwnerId) {
      setError("Selecione o proprietario do metodo PIX.");
      return;
    }

    if (!pixKeyValue.trim()) {
      setError("Informe a chave PIX.");
      return;
    }

    setCreatingPayoutMethod(true);
    try {
      const result = await createOwnerPayoutMethod({
        ownerId: payoutOwnerId,
        pixKeyType,
        pixKeyValue: pixKeyValue.trim(),
        holderName: holderName.trim() || null,
        holderTaxId: holderTaxId.trim() || null,
        makeDefault: true,
      });

      if (result?.wallet) {
        setWallet(result.wallet);
      }
      if (result?.payoutMethod?.id) {
        setSelectedPayoutMethodId(result.payoutMethod.id);
      }
      setPixKeyValue("");
      setHolderName("");
      setHolderTaxId("");
      setSuccess("Metodo PIX cadastrado com sucesso e liberado para saque.");
      await loadData({ keepMessages: true });
    } catch (createError) {
      setError(createError?.message || "Nao foi possivel cadastrar o metodo PIX.");
    } finally {
      setCreatingPayoutMethod(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-xl border border-border/80 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <Wallet className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Saldo disponivel</p>
              <p className="text-lg font-bold text-emerald-600">
                {formatCurrency(balances.available || 0)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/80 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock3 className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Saldo pendente 20 s</p>
              <p className="text-lg font-bold text-foreground">
                {formatCurrency(balances.pending || 0)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/80 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
              <ArrowDownToLine className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Reservado / em fila</p>
              <p className="text-lg font-bold text-foreground">
                {formatCurrency(Math.max(balances.reserved || 0, 0))}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/80 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-500/10">
              <Lock className="h-5 w-5 text-zinc-700" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Bloqueado / em analise</p>
              <p className="text-lg font-bold text-foreground">
                {formatCurrency(balances.blocked || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-5">
        <Card className="self-start rounded-xl border border-border/80 shadow-sm xl:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Solicitar saque seguro</CardTitle>
            <CardDescription>
              O backend recalcula o saldo elegivel em transacao, reserva o valor e ignora qualquer
              escopo enviado pelo frontend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreatePayoutMethod} className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Metodo PIX do proprietario</p>
                <p className="text-xs text-muted-foreground">
                  O saque nunca usa uma chave enviada junto da solicitacao. Primeiro o metodo fica cadastrado no backend e depois e reutilizado nas requisicoes.
                </p>
              </div>

              {(wallet?.owners || []).length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Proprietario</label>
                  <Select value={payoutOwnerId} onValueChange={setPayoutOwnerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um proprietario" />
                    </SelectTrigger>
                    <SelectContent>
                      {(wallet?.owners || []).map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {owner.displayName || owner.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Tipo da chave PIX</label>
                  <Select value={pixKeyType} onValueChange={setPixKeyType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PIX_KEY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Chave PIX</label>
                  <Input
                    type="text"
                    placeholder="Informe a chave"
                    value={pixKeyValue}
                    onChange={(event) => setPixKeyValue(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Nome do titular <span className="text-muted-foreground">(opcional)</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="Como aparece no banco"
                    value={holderName}
                    onChange={(event) => setHolderName(event.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    CPF/CNPJ do titular <span className="text-muted-foreground">(opcional)</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="Somente para auditoria"
                    value={holderTaxId}
                    onChange={(event) => setHolderTaxId(event.target.value)}
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={creatingPayoutMethod || !(payoutOwnerId && pixKeyValue.trim())}
              >
                {creatingPayoutMethod ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando metodo PIX...
                  </>
                ) : (
                  "Cadastrar metodo PIX"
                )}
              </Button>
            </form>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Metodo PIX verificado</label>
                <Select value={selectedPayoutMethodId} onValueChange={setSelectedPayoutMethodId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um metodo" />
                  </SelectTrigger>
                  <SelectContent>
                    {verifiedPayoutMethods.length === 0 ? (
                      <SelectItem value="__no_methods__" disabled>
                        Nenhum metodo verificado
                      </SelectItem>
                    ) : (
                      verifiedPayoutMethods.map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          {formatOwnerMethodLabel(method, ownerNameById)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Valor do saque</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Minimo: {formatCurrency(wallet?.minimumWithdrawal || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Taxa fixa por saque: {formatCurrency(WITHDRAWAL_FEE)}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Observacao interna <span className="text-muted-foreground">(opcional)</span>
                </label>
                <Input
                  type="text"
                  placeholder="Ex: saque mensal de abril"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={500}
                />
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Saldo disponivel validado</span>
                  <span className="font-semibold">{formatCurrency(balances.available || 0)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Valor solicitado</span>
                  <span className="font-semibold">{formatCurrency(parsedAmount || 0)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Taxa de saque</span>
                  <span className="font-semibold text-red-600">-{formatCurrency(WITHDRAWAL_FEE)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Valor liquido estimado</span>
                  <span className="font-semibold">{formatCurrency(estimatedNetAmount || 0)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border/50 pt-2 text-sm">
                  <span className="font-semibold">Liquidacao</span>
                  <span className="font-medium text-muted-foreground">
                    Envio automatico com conciliacao AbacatePay
                  </span>
                </div>

              </div>

              {verifiedPayoutMethods.length === 0 && (
                <p className="text-sm font-medium text-amber-700">
                  Nenhum metodo PIX verificado foi encontrado para este proprietario.
                </p>
              )}
              {error && <p className="text-sm font-medium text-red-600">{error}</p>}
              {success && <p className="text-sm font-medium text-emerald-600">{success}</p>}

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reservando saldo...
                  </>
                ) : (
                  "Solicitar saque"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6 xl:col-span-3">
          <Card className="rounded-xl border border-border/80 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Historico de saques</CardTitle>
              <CardDescription>
                Cada solicitacao fica vinculada ao proprietario autenticado, com snapshot de saldo
                e status final auditavel.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
              ) : withdrawals.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum saque solicitado ainda.
                </p>
              ) : (
                <div className="rounded-lg border border-border/50">
                  <table className="w-full table-fixed text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="h-10 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                          Data
                        </th>
                        <th className="h-10 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                          Valor
                        </th>
                        <th className="h-10 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                          Metodo PIX
                        </th>
                        <th className="h-10 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                          Status
                        </th>
                        <th className="h-10 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                          Observacao
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawals.map((withdrawal) => {
                        const statusConfig =
                          STATUS_CONFIG[withdrawal.status] || STATUS_CONFIG.requested;
                        const payoutMethod = (wallet?.payoutMethods || []).find(
                          (method) => method.id === withdrawal.payoutMethodId
                        );

                        return (
                          <tr
                            key={withdrawal.id}
                            className="border-b border-border/30 last:border-0 hover:bg-muted/20"
                          >
                            <td className="px-3 py-2.5 align-middle">
                              {formatDateTime(withdrawal.requestedAt)}
                            </td>
                            <td className="px-3 py-2.5 align-middle font-semibold">
                              {formatCurrency(withdrawal.netAmount || 0)}
                            </td>
                            <td className="truncate px-3 py-2.5 align-middle text-muted-foreground">
                              {payoutMethod
                                ? formatOwnerMethodLabel(payoutMethod, ownerNameById)
                                : "Metodo removido"}
                            </td>
                            <td className="px-3 py-2.5 align-middle">
                              <Badge
                                variant="outline"
                                className={cn("font-medium", statusConfig.className)}
                              >
                                {statusConfig.label}
                              </Badge>
                            </td>
                            <td className="truncate px-3 py-2.5 align-middle text-muted-foreground">
                              {withdrawal.metadata?.note || withdrawal.failureReason || "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border/80 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Razao financeiro recente</CardTitle>
              <CardDescription>
                Creditos, reservas, estornos e debitos publicados para a carteira do proprietario.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
              ) : visibleLedgerItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma movimentacao auditavel encontrada.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {visibleLedgerItems.map((entry) => {
                    const amountClass =
                      entry.direction === "credit" ? "text-emerald-600" : "text-red-600";

                    return (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-border/60 bg-muted/15 px-4 py-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {LEDGER_LABELS[entry.entryType] || entry.entryType}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(entry.createdAt)}
                              {entry.paymentId ? ` • pagamento ${entry.paymentId}` : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={cn("text-sm font-bold", amountClass)}>
                              {entry.direction === "credit" ? "+" : "-"}
                              {formatCurrency(entry.amount || 0)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.availableAt
                                ? `Disponivel em ${formatDateTime(entry.availableAt)}`
                                : entry.status}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                    })}
                  </div>

                  {ledgerLimit < EXPANDED_LEDGER_LIMIT &&
                    visibleLedgerItems.length >= INITIAL_LEDGER_LIMIT && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleShowOlderLedgerItems}
                        disabled={loading}
                      >
                        Ver mais antigos
                      </Button>
                    )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
