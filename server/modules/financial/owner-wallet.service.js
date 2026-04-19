import { getServiceRoleClient, getSupabaseClient } from "@/database/supabaseClient";
import {
  buildAbacatePixTransferPayload,
  extractAbacatepayExternalId,
  MIN_WITHDRAWAL_CENTS,
  centsToAmount,
  mapAbacatepixTransferStatusToWithdrawalResolution,
  mapWithdrawalStatusLabel,
  maskPixKey,
  maskTaxId,
  normalizeAbacatepayEventType,
  normalizePixKeyType,
  normalizeTaxId,
  parseCurrencyInputToCents,
  resolveEffectiveAvailableAt,
  validatePixKeyValue,
} from "@/server/modules/financial/owner-wallet.utils";
import { shouldDisplayOwnerLedgerEntry } from "@/server/modules/financial/owner-wallet.rules";
import {
  getPixTransferByExternalId,
  sanitizePixTransferResponse,
  sendPixTransfer,
} from "@/server/modules/financial/abacatepay.service";

function tableMissingError(error, identifier) {
  const message = String(error?.message || "");
  return error?.code === "42P01" || message.includes(identifier);
}

function rpcMissingError(error, identifier) {
  const message = String(error?.message || "");
  return error?.code === "42883" || message.includes(identifier);
}

function toSafeArray(data) {
  return Array.isArray(data) ? data : [];
}

function clampRange(limit, offset) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  return { safeLimit, safeOffset };
}

function nowIso() {
  return new Date().toISOString();
}

const WITHDRAWAL_LIST_SELECT =
  "id, owner_id, payout_method_id, status, requested_amount_cents, fee_cents, net_amount_cents, requested_at, queued_at, reserved_at, settled_at, failed_at, cancelled_at, failure_code, failure_reason, correlation_id, balance_snapshot, request_metadata, provider_reference_id, provider_status, provider_end_to_end_identifier, provider_last_event_type, provider_last_http_status, provider_attempt_count, provider_next_retry_at, provider_last_error, last_provider_sync_at, updated_at, created_at";

const WITHDRAWAL_EXECUTION_SELECT = `${WITHDRAWAL_LIST_SELECT}, organization_id, sanitized_provider_request, sanitized_provider_response`;

function buildEmptyWalletOverview(ownerIds = []) {
  return {
    ownerIds,
    owners: [],
    payoutMethods: [],
    balances: {
      grossCents: 0,
      gross: 0,
      pendingCents: 0,
      pending: 0,
      availableCents: 0,
      available: 0,
      reservedCents: 0,
      reserved: 0,
      blockedCents: 0,
      blocked: 0,
    },
    withdrawalsEnabled: false,
    minimumWithdrawalCents: MIN_WITHDRAWAL_CENTS,
    minimumWithdrawal: centsToAmount(MIN_WITHDRAWAL_CENTS),
  };
}

function mapWalletRow(row = {}, ownerName = null) {
  return {
    ownerId: row.owner_id,
    ownerName,
    grossCents: Number(row.gross_cents) || 0,
    gross: centsToAmount(row.gross_cents),
    pendingCents: Number(row.pending_cents) || 0,
    pending: centsToAmount(row.pending_cents),
    availableCents: Number(row.available_cents) || 0,
    available: centsToAmount(row.available_cents),
    reservedCents: Number(row.reserved_cents) || 0,
    reserved: centsToAmount(row.reserved_cents),
    blockedCents: Number(row.blocked_cents) || 0,
    blocked: centsToAmount(row.blocked_cents),
    version: Number(row.version) || 0,
    updatedAt: row.updated_at || null,
    lastReconciledAt: row.last_reconciled_at || null,
  };
}

function mapPayoutMethodRow(row = {}) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    method: row.method,
    pixKeyType: row.pix_key_type,
    pixKeyMasked: row.pix_key_masked,
    verificationStatus: row.verification_status,
    isDefault: !!row.is_default,
    active: !!row.active,
    createdAt: row.created_at || null,
  };
}

function normalizeOwnerSet(ownerIds = []) {
  return Array.from(new Set((ownerIds || []).map(String).filter(Boolean)));
}

function mapWithdrawalRow(row = {}) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    payoutMethodId: row.payout_method_id,
    status: mapWithdrawalStatusLabel(row.status),
    requestedAmountCents: Number(row.requested_amount_cents) || 0,
    requestedAmount: centsToAmount(row.requested_amount_cents),
    feeCents: Number(row.fee_cents) || 0,
    fee: centsToAmount(row.fee_cents),
    netAmountCents: Number(row.net_amount_cents) || 0,
    netAmount: centsToAmount(row.net_amount_cents),
    requestedAt: row.requested_at || row.created_at || null,
    queuedAt: row.queued_at || null,
    reservedAt: row.reserved_at || null,
    settledAt: row.settled_at || null,
    failedAt: row.failed_at || null,
    cancelledAt: row.cancelled_at || null,
    failureCode: row.failure_code || null,
    failureReason: row.failure_reason || null,
    correlationId: row.correlation_id || null,
    balanceSnapshot: row.balance_snapshot || {},
    metadata: row.request_metadata || {},
    provider: {
      referenceId: row.provider_reference_id || null,
      status: row.provider_status || null,
      endToEndIdentifier: row.provider_end_to_end_identifier || null,
      lastEventType: row.provider_last_event_type || null,
      lastHttpStatus:
        row.provider_last_http_status == null ? null : Number(row.provider_last_http_status),
      attemptCount: Number(row.provider_attempt_count) || 0,
      nextRetryAt: row.provider_next_retry_at || null,
      lastError: row.provider_last_error || null,
      lastSyncAt: row.last_provider_sync_at || null,
    },
    updatedAt: row.updated_at || null,
  };
}

const FINAL_WITHDRAWAL_STATUSES = new Set(["succeeded", "failed", "cancelled"]);
const ACTIVE_WITHDRAWAL_STATUSES = new Set([
  "requested",
  "reserved",
  "processing",
  "provider_pending",
  "queued_manual_settlement",
]);

function logWithdrawalEvent(event, payload = {}, level = "info") {
  const safePayload = {
    event,
    service: "owner_withdrawal",
    at: nowIso(),
    ...payload,
  };

  const writer = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  writer(JSON.stringify(safePayload));
}

function isFinalWithdrawalStatus(status) {
  return FINAL_WITHDRAWAL_STATUSES.has(String(status || "").trim().toLowerCase());
}

function isActiveWithdrawalStatus(status) {
  return ACTIVE_WITHDRAWAL_STATUSES.has(String(status || "").trim().toLowerCase());
}

function buildWithdrawalRetryAt(attemptCount = 0) {
  const safeAttempt = Math.max(Number(attemptCount) || 0, 0);
  const delaySeconds = safeAttempt <= 1 ? 15 : safeAttempt === 2 ? 30 : safeAttempt === 3 ? 60 : 180;
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

function isTransientProviderError(error) {
  return (
    !!error?.isTransient ||
    error?.status === 408 ||
    error?.status === 429 ||
    error?.status === 500 ||
    error?.status === 502 ||
    error?.status === 503 ||
    error?.status === 504
  );
}

function isProviderConfigurationError(error) {
  const message = String(error?.message || "");
  return message.includes("ABACATEPAY_API_KEY") || message.includes("nao configurada");
}

function mapLedgerRow(row = {}) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    entryType: row.entry_type,
    direction: row.direction,
    status: row.status,
    amountCents: Number(row.amount_cents) || 0,
    amount: centsToAmount(row.amount_cents),
    availableAt: resolveEffectiveAvailableAt({
      entryType: row.entry_type,
      paidAt: row.metadata?.paidAt || null,
      availableAt: row.available_at || null,
      createdAt: row.created_at || null,
    }),
    paymentId: row.payment_id || null,
    checkoutId: row.checkout_id || null,
    withdrawalRequestId: row.withdrawal_request_id || null,
    correlationId: row.correlation_id || null,
    source: row.source || null,
    metadata: row.metadata || {},
    createdAt: row.created_at || null,
  };
}

async function refreshWalletSummaries(ownerIds = []) {
  const supabase = getSupabaseClient();
  const { reconcileMissingWalletCredits } = await import(
    "@/server/modules/financial/payment-gateway.service"
  );
  await reconcileMissingWalletCredits({ ownerIds }).catch((error) => {
    console.error("reconcileMissingWalletCredits error:", error);
  });
  await reconcilePendingWithdrawalsForOwners(ownerIds).catch((error) => {
    logWithdrawalEvent(
      "owner_read_reconciliation_failed",
      {
        ownerIds,
        message: error?.message || "owner_read_reconciliation_failed",
      },
      "warn"
    );
  });

  for (const ownerId of ownerIds) {
    const { error } = await supabase.rpc("refresh_owner_wallet_summary", {
      p_owner_id: ownerId,
    });

    if (error && !rpcMissingError(error, "refresh_owner_wallet_summary")) {
      throw error;
    }
  }
}

export async function getOwnerWalletOverview({ ownerIds = [] } = {}) {
  const uniqueOwnerIds = normalizeOwnerSet(ownerIds);
  if (!uniqueOwnerIds.length) return buildEmptyWalletOverview([]);

  await refreshWalletSummaries(uniqueOwnerIds);

  const supabase = getSupabaseClient();
  const [ownersResult, walletsResult, payoutMethodsResult] = await Promise.all([
    supabase
      .from("owner_profiles")
      .select("id, display_name, status")
      .in("id", uniqueOwnerIds)
      .order("display_name", { ascending: true }),
    supabase
      .from("owner_wallets")
      .select(
        "owner_id, gross_cents, pending_cents, available_cents, reserved_cents, blocked_cents, version, updated_at, last_reconciled_at"
      )
      .in("owner_id", uniqueOwnerIds),
    supabase
      .from("owner_payout_methods")
      .select(
        "id, owner_id, method, pix_key_type, pix_key_masked, verification_status, is_default, active, created_at"
      )
      .in("owner_id", uniqueOwnerIds)
      .eq("active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
  ]);

  if (ownersResult.error && !tableMissingError(ownersResult.error, "owner_profiles")) {
    throw ownersResult.error;
  }
  if (walletsResult.error && !tableMissingError(walletsResult.error, "owner_wallets")) {
    throw walletsResult.error;
  }
  if (
    payoutMethodsResult.error &&
    !tableMissingError(payoutMethodsResult.error, "owner_payout_methods")
  ) {
    throw payoutMethodsResult.error;
  }

  const owners = toSafeArray(ownersResult.data);
  const ownerNameById = Object.fromEntries(
    owners.map((owner) => [owner.id, owner.display_name || `Owner ${owner.id}`])
  );

  const wallets = toSafeArray(walletsResult.data).map((row) =>
    mapWalletRow(row, ownerNameById[row.owner_id] || null)
  );
  const payoutMethods = toSafeArray(payoutMethodsResult.data).map(mapPayoutMethodRow);

  const balances = wallets.reduce(
    (acc, wallet) => {
      acc.grossCents += wallet.grossCents;
      acc.pendingCents += wallet.pendingCents;
      acc.availableCents += wallet.availableCents;
      acc.reservedCents += wallet.reservedCents;
      acc.blockedCents += wallet.blockedCents;
      return acc;
    },
    {
      grossCents: 0,
      pendingCents: 0,
      availableCents: 0,
      reservedCents: 0,
      blockedCents: 0,
    }
  );

  return {
    ownerIds: uniqueOwnerIds,
    owners: owners.map((owner) => ({
      id: owner.id,
      displayName: owner.display_name,
      status: owner.status,
      wallet:
        wallets.find((wallet) => wallet.ownerId === owner.id) ||
        mapWalletRow({ owner_id: owner.id }, owner.display_name),
    })),
    payoutMethods,
    balances: {
      ...balances,
      gross: centsToAmount(balances.grossCents),
      pending: centsToAmount(balances.pendingCents),
      available: centsToAmount(balances.availableCents),
      reserved: centsToAmount(balances.reservedCents),
      blocked: centsToAmount(balances.blockedCents),
    },
    withdrawalsEnabled: payoutMethods.some((method) => method.verificationStatus === "verified"),
    minimumWithdrawalCents: MIN_WITHDRAWAL_CENTS,
    minimumWithdrawal: centsToAmount(MIN_WITHDRAWAL_CENTS),
  };
}

export async function listOwnerWalletLedger({ ownerIds = [], limit = 20, offset = 0 } = {}) {
  const uniqueOwnerIds = normalizeOwnerSet(ownerIds);
  if (!uniqueOwnerIds.length) return { items: [], pagination: { limit: 0, offset: 0 } };

  const { safeLimit, safeOffset } = clampRange(limit, offset);
  const supabase = getSupabaseClient();
  const query = supabase
    .from("wallet_ledger")
    .select(
      "id, owner_id, entry_type, direction, status, amount_cents, available_at, payment_id, checkout_id, withdrawal_request_id, correlation_id, source, metadata, created_at"
    )
    .in("owner_id", uniqueOwnerIds)
    .order("created_at", { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  const { data, error } = await query;
  if (error && !tableMissingError(error, "wallet_ledger")) {
    throw error;
  }

  return {
    items: toSafeArray(data).map(mapLedgerRow).filter(shouldDisplayOwnerLedgerEntry),
    pagination: { limit: safeLimit, offset: safeOffset },
  };
}

export async function listOwnerWithdrawals({ ownerIds = [], limit = 20, offset = 0 } = {}) {
  const uniqueOwnerIds = normalizeOwnerSet(ownerIds);
  if (!uniqueOwnerIds.length) return { items: [], pagination: { limit: 0, offset: 0 } };

  await reconcilePendingWithdrawalsForOwners(uniqueOwnerIds).catch((error) => {
    logWithdrawalEvent(
      "withdrawal_list_reconciliation_failed",
      {
        ownerIds: uniqueOwnerIds,
        message: error?.message || "withdrawal_list_reconciliation_failed",
      },
      "warn"
    );
  });

  const { safeLimit, safeOffset } = clampRange(limit, offset);
  const supabase = getSupabaseClient();
  const query = supabase
    .from("withdrawal_requests")
    .select(WITHDRAWAL_LIST_SELECT)
    .in("owner_id", uniqueOwnerIds)
    .order("created_at", { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  const { data, error } = await query;
  if (error && !tableMissingError(error, "withdrawal_requests")) {
    throw error;
  }

  return {
    items: toSafeArray(data).map(mapWithdrawalRow),
    pagination: { limit: safeLimit, offset: safeOffset },
  };
}

export async function getOwnerWithdrawalById({ ownerIds = [], withdrawalId } = {}) {
  const uniqueOwnerIds = normalizeOwnerSet(ownerIds);
  if (!withdrawalId || !uniqueOwnerIds.length) return null;

  await reconcilePendingWithdrawalsForOwners(uniqueOwnerIds).catch((error) => {
    logWithdrawalEvent(
      "withdrawal_detail_reconciliation_failed",
      {
        ownerIds: uniqueOwnerIds,
        withdrawalId,
        message: error?.message || "withdrawal_detail_reconciliation_failed",
      },
      "warn"
    );
  });

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select(WITHDRAWAL_LIST_SELECT)
    .eq("id", withdrawalId)
    .in("owner_id", uniqueOwnerIds)
    .maybeSingle();

  if (error && !tableMissingError(error, "withdrawal_requests")) {
    throw error;
  }

  return data ? mapWithdrawalRow(data) : null;
}

function unwrapRpcSingleRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

function mapWithdrawalRpcError(error) {
  const message = String(error?.message || "");
  if (message.includes("verified payout method not found")) {
    return "Metodo PIX nao encontrado ou ainda nao validado.";
  }
  if (message.includes("owner payout method access denied")) {
    return "Voce nao pode solicitar saque para este proprietario.";
  }
  if (message.includes("insufficient available balance")) {
    return "Saldo disponivel insuficiente para o saque.";
  }
  if (message.includes("idempotency key is required")) {
    return "A requisicao de saque precisa de idempotencia.";
  }
  if (message.includes("minimum withdrawal amount")) {
    return `O valor minimo para saque e ${centsToAmount(MIN_WITHDRAWAL_CENTS).toFixed(2)}.`;
  }
  return error?.message || "Nao foi possivel criar a solicitacao de saque.";
}

async function fetchWithdrawalRowById(serviceClient, withdrawalId) {
  if (!withdrawalId) return null;

  const { data, error } = await serviceClient
    .from("withdrawal_requests")
    .select(WITHDRAWAL_EXECUTION_SELECT)
    .eq("id", withdrawalId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function fetchWithdrawalRowByExternalId(serviceClient, externalId) {
  const normalizedExternalId = String(externalId || "").trim();
  if (!normalizedExternalId) return null;

  const directMatch = await fetchWithdrawalRowById(serviceClient, normalizedExternalId).catch(
    (error) => {
      if (error?.code === "22P02") return null;
      throw error;
    }
  );
  if (directMatch) return directMatch;

  const { data, error } = await serviceClient
    .from("withdrawal_requests")
    .select(WITHDRAWAL_EXECUTION_SELECT)
    .eq("correlation_id", normalizedExternalId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function fetchWithdrawalRowByProviderReferenceId(serviceClient, providerReferenceId) {
  const normalizedProviderReferenceId = String(providerReferenceId || "").trim();
  if (!normalizedProviderReferenceId) return null;

  const { data, error } = await serviceClient
    .from("withdrawal_requests")
    .select(WITHDRAWAL_EXECUTION_SELECT)
    .eq("provider_reference_id", normalizedProviderReferenceId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function fetchWithdrawalRowForProviderWebhook(
  serviceClient,
  { externalId = null, providerReferenceId = null } = {}
) {
  const byExternalId = await fetchWithdrawalRowByExternalId(serviceClient, externalId);
  if (byExternalId) return byExternalId;
  return fetchWithdrawalRowByProviderReferenceId(serviceClient, providerReferenceId);
}

async function fetchWithdrawalExecutionContext(serviceClient, withdrawalId) {
  const withdrawalRow = await fetchWithdrawalRowById(serviceClient, withdrawalId);
  if (!withdrawalRow) return null;

  const [payoutMethodResult, ownerProfileResult] = await Promise.all([
    serviceClient
      .from("owner_payout_methods")
      .select(
        "id, owner_id, active, verification_status, pix_key_type, pix_key_value, pix_key_masked, holder_name, holder_tax_id"
      )
      .eq("id", withdrawalRow.payout_method_id)
      .maybeSingle(),
    serviceClient
      .from("owner_profiles")
      .select("id, display_name, legal_name, tax_id")
      .eq("id", withdrawalRow.owner_id)
      .maybeSingle(),
  ]);

  if (payoutMethodResult.error) throw payoutMethodResult.error;
  if (ownerProfileResult.error) throw ownerProfileResult.error;

  return {
    withdrawalRow,
    payoutMethodRow: payoutMethodResult.data || null,
    ownerProfileRow: ownerProfileResult.data || null,
  };
}

function buildWithdrawalProviderDescription(withdrawalRow = {}) {
  const requestNote = String(withdrawalRow?.request_metadata?.note || "").trim();
  return requestNote || "Repasse SaaS";
}

function buildWithdrawalPixTransferPayload(context = {}) {
  const withdrawalRow = context?.withdrawalRow || {};
  const payoutMethodRow = context?.payoutMethodRow || {};
  const amountCents =
    Number(withdrawalRow.net_amount_cents) || Number(withdrawalRow.requested_amount_cents) || 0;

  return buildAbacatePixTransferPayload({
    amountCents,
    externalId: withdrawalRow.id,
    description: buildWithdrawalProviderDescription(withdrawalRow),
    pixKey: payoutMethodRow.pix_key_value,
    pixKeyType: payoutMethodRow.pix_key_type,
  });
}

function buildWithdrawalProviderRequestAudit(payload = {}, context = {}) {
  const payoutMethodRow = context?.payoutMethodRow || {};
  const ownerProfileRow = context?.ownerProfileRow || {};
  const pixKeyType = payload?.pix?.type || null;
  const pixKeyValue = payload?.pix?.key || "";

  return {
    provider: "abacatepay",
    operation: "payout_create",
    attemptedAt: nowIso(),
    ownerId: context?.withdrawalRow?.owner_id || null,
    payoutMethodId: context?.withdrawalRow?.payout_method_id || null,
    amount: payload.amount ?? null,
    externalId: payload.externalId || null,
    method: payload.method || null,
    description: payload.description || null,
    pixKeyType,
    pixKeyMasked: maskPixKey(pixKeyValue, pixKeyType),
    holderName:
      payoutMethodRow.holder_name ||
      ownerProfileRow.legal_name ||
      ownerProfileRow.display_name ||
      null,
    holderTaxIdMasked: maskTaxId(payoutMethodRow.holder_tax_id || ownerProfileRow.tax_id || null),
  };
}

function buildWithdrawalProviderResponseAudit(payload = {}, extra = {}) {
  return {
    provider: "abacatepay",
    operation: "payout_create",
    processedAt: nowIso(),
    ...sanitizePixTransferResponse(payload),
    ...extra,
  };
}

async function updateWithdrawalProviderLogs(serviceClient, withdrawalId, patch = {}) {
  const updatePayload = { updated_at: nowIso() };

  if (Object.prototype.hasOwnProperty.call(patch, "sanitized_provider_request")) {
    updatePayload.sanitized_provider_request = patch.sanitized_provider_request || {};
  }
  if (Object.prototype.hasOwnProperty.call(patch, "sanitized_provider_response")) {
    updatePayload.sanitized_provider_response = patch.sanitized_provider_response || {};
  }
  if (Object.prototype.hasOwnProperty.call(patch, "status")) {
    updatePayload.status = patch.status;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "provider_reference_id")) {
    updatePayload.provider_reference_id = patch.provider_reference_id || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "provider_status")) {
    updatePayload.provider_status = patch.provider_status || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "provider_end_to_end_identifier")) {
    updatePayload.provider_end_to_end_identifier = patch.provider_end_to_end_identifier || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "provider_last_event_type")) {
    updatePayload.provider_last_event_type = patch.provider_last_event_type || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "provider_last_http_status")) {
    updatePayload.provider_last_http_status = patch.provider_last_http_status ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "provider_attempt_count")) {
    updatePayload.provider_attempt_count = Math.max(Number(patch.provider_attempt_count) || 0, 0);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "provider_next_retry_at")) {
    updatePayload.provider_next_retry_at = patch.provider_next_retry_at || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "provider_last_error")) {
    updatePayload.provider_last_error = patch.provider_last_error || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "last_provider_sync_at")) {
    updatePayload.last_provider_sync_at = patch.last_provider_sync_at || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "reserved_at")) {
    updatePayload.reserved_at = patch.reserved_at || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "queued_at")) {
    updatePayload.queued_at = patch.queued_at || null;
  }

  const { error } = await serviceClient
    .from("withdrawal_requests")
    .update(updatePayload)
    .eq("id", withdrawalId);

  if (error) throw error;
}

async function resolveOwnerWithdrawalWithService({
  serviceClient,
  withdrawalId,
  resolution,
  failureReason = null,
  providerResponse = {},
} = {}) {
  const { data, error } = await serviceClient.rpc("resolve_owner_withdrawal_request", {
    p_withdrawal_id: withdrawalId,
    p_resolution: resolution,
    p_failure_reason: failureReason,
    p_provider_response: providerResponse || {},
  });

  if (error) throw error;
  return unwrapRpcSingleRow(data) || null;
}

function buildWithdrawalProviderStatePatch(providerResponse = {}, extra = {}) {
  const patch = {
    last_provider_sync_at: extra.last_provider_sync_at || nowIso(),
  };

  if (Object.prototype.hasOwnProperty.call(extra, "provider_attempt_count")) {
    patch.provider_attempt_count = extra.provider_attempt_count;
  }
  if (Object.prototype.hasOwnProperty.call(extra, "provider_last_http_status")) {
    patch.provider_last_http_status =
      extra.provider_last_http_status == null ? null : extra.provider_last_http_status;
  }
  if (Object.prototype.hasOwnProperty.call(extra, "provider_next_retry_at")) {
    patch.provider_next_retry_at = extra.provider_next_retry_at || null;
  }
  if (Object.prototype.hasOwnProperty.call(extra, "provider_last_error")) {
    patch.provider_last_error = extra.provider_last_error || null;
  }
  if (Object.prototype.hasOwnProperty.call(extra, "provider_last_event_type")) {
    patch.provider_last_event_type = extra.provider_last_event_type || null;
  }

  if (providerResponse.id || extra.provider_reference_id) {
    patch.provider_reference_id = providerResponse.id || extra.provider_reference_id;
  }
  if (providerResponse.status || extra.provider_status) {
    patch.provider_status = providerResponse.status || extra.provider_status;
  }
  if (providerResponse.endToEndIdentifier || extra.provider_end_to_end_identifier) {
    patch.provider_end_to_end_identifier =
      providerResponse.endToEndIdentifier || extra.provider_end_to_end_identifier;
  }

  return patch;
}

async function persistPendingWithdrawalState({
  serviceClient,
  withdrawalId,
  status,
  providerResponse = {},
  providerRequest = undefined,
  providerAttemptCount,
  providerLastError = null,
  providerLastHttpStatus = null,
  providerLastEventType = null,
  providerNextRetryAt = null,
} = {}) {
  await updateWithdrawalProviderLogs(serviceClient, withdrawalId, {
    ...(providerRequest === undefined
      ? {}
      : { sanitized_provider_request: providerRequest || {} }),
    sanitized_provider_response: providerResponse || {},
    status,
    ...buildWithdrawalProviderStatePatch(providerResponse, {
      provider_attempt_count: providerAttemptCount,
      provider_last_error: providerLastError,
      provider_last_http_status: providerLastHttpStatus,
      provider_last_event_type: providerLastEventType,
      provider_next_retry_at: providerNextRetryAt,
    }),
  });

  const currentRow = await fetchWithdrawalRowById(serviceClient, withdrawalId);
  return currentRow ? mapWithdrawalRow(currentRow) : null;
}

async function finalizeWithdrawalFromProviderState({
  serviceClient,
  withdrawalId,
  providerResponse = {},
  resolution,
  failureReason = null,
} = {}) {
  const resolvedRow = await resolveOwnerWithdrawalWithService({
    serviceClient,
    withdrawalId,
    resolution,
    failureReason,
    providerResponse,
  });

  return resolvedRow ? mapWithdrawalRow(resolvedRow) : null;
}

async function lookupProviderWithdrawalByExternalId(withdrawalRow = {}) {
  const externalId = withdrawalRow?.id ? String(withdrawalRow.id) : "";
  if (!externalId) return null;
  return getPixTransferByExternalId(externalId);
}

function shouldExecuteWithdrawalProviderCall(withdrawalRow = {}) {
  const currentStatus = String(withdrawalRow?.status || "").trim().toLowerCase();
  if (isFinalWithdrawalStatus(currentStatus)) return false;
  if (currentStatus === "provider_pending" && withdrawalRow?.provider_reference_id) return false;

  return currentStatus === "reserved" || currentStatus === "requested" || currentStatus === "queued_manual_settlement";
}

async function failWithdrawalWithoutProviderCall(serviceClient, withdrawalId, reason, extra = {}) {
  const providerResponse = buildWithdrawalProviderResponseAudit({}, {
    errorMessage: reason,
    skippedBeforeProviderCall: true,
    ...extra,
  });

  const resolvedRow = await resolveOwnerWithdrawalWithService({
    serviceClient,
    withdrawalId,
    resolution: "failed",
    failureReason: reason,
    providerResponse,
  });

  return resolvedRow ? mapWithdrawalRow(resolvedRow) : null;
}

async function syncWithdrawalWithProviderLookup(serviceClient, withdrawalRow, options = {}) {
  if (!withdrawalRow?.id || isFinalWithdrawalStatus(withdrawalRow.status)) {
    return withdrawalRow ? mapWithdrawalRow(withdrawalRow) : null;
  }

  try {
    const providerLookupResult = await lookupProviderWithdrawalByExternalId(withdrawalRow);
    const providerResponse = buildWithdrawalProviderResponseAudit(providerLookupResult, {
      syncSource: options.syncSource || "provider_lookup",
    });
    const resolution = mapAbacatepixTransferStatusToWithdrawalResolution(providerResponse.status);

    logWithdrawalEvent("provider_lookup_completed", {
      withdrawalId: withdrawalRow.id,
      ownerId: withdrawalRow.owner_id,
      providerReferenceId: providerResponse.id || null,
      providerStatus: providerResponse.status || null,
      resolution,
      syncSource: options.syncSource || "provider_lookup",
    });

    if (!resolution) {
      return persistPendingWithdrawalState({
        serviceClient,
        withdrawalId: withdrawalRow.id,
        status: "provider_pending",
        providerResponse,
        providerAttemptCount: Number(withdrawalRow.provider_attempt_count) || 0,
        providerLastEventType: options.providerLastEventType || null,
        providerNextRetryAt: buildWithdrawalRetryAt(withdrawalRow.provider_attempt_count),
      });
    }

    return finalizeWithdrawalFromProviderState({
      serviceClient,
      withdrawalId: withdrawalRow.id,
      providerResponse,
      resolution,
      failureReason:
        resolution === "succeeded" ? null : "Falha ao enviar PIX via AbacatePay.",
    });
  } catch (error) {
    if (error?.status === 404) {
      return null;
    }

    await persistPendingWithdrawalState({
      serviceClient,
      withdrawalId: withdrawalRow.id,
      status: "processing",
      providerResponse: buildWithdrawalProviderResponseAudit(error?.providerData || {}, {
        errorMessage: error?.message || "provider_lookup_failed",
        httpStatus: error?.status || null,
        lookupOnly: true,
      }),
      providerAttemptCount: Number(withdrawalRow.provider_attempt_count) || 0,
      providerLastError: error?.message || "provider_lookup_failed",
      providerLastHttpStatus: error?.status || null,
      providerNextRetryAt: buildWithdrawalRetryAt(withdrawalRow.provider_attempt_count),
    }).catch(() => {});

    if (!isTransientProviderError(error)) {
      throw error;
    }

    return mapWithdrawalRow(withdrawalRow);
  }
}

async function executeQueuedWithdrawalPixSend(withdrawalId, options = {}) {
  const serviceClient = options.serviceClient || getServiceRoleClient();
  const context = await fetchWithdrawalExecutionContext(serviceClient, withdrawalId);
  if (!context?.withdrawalRow) return null;

  if (!shouldExecuteWithdrawalProviderCall(context.withdrawalRow) && !options.force) {
    return mapWithdrawalRow(context.withdrawalRow);
  }

  if (!context.payoutMethodRow?.active || context.payoutMethodRow?.verification_status !== "verified") {
    return failWithdrawalWithoutProviderCall(
      serviceClient,
      withdrawalId,
      "Metodo PIX nao encontrado ou ainda nao validado."
    );
  }

  const pixKeyValidation = validatePixKeyValue(
    context.payoutMethodRow.pix_key_value,
    context.payoutMethodRow.pix_key_type
  );
  if (!pixKeyValidation.valid) {
    return failWithdrawalWithoutProviderCall(
      serviceClient,
      withdrawalId,
      "A chave PIX cadastrada para o saque e invalida.",
      {
        validationReason: pixKeyValidation.reason,
      }
    );
  }

  if (Number(context.withdrawalRow.requested_amount_cents) < MIN_WITHDRAWAL_CENTS) {
    return failWithdrawalWithoutProviderCall(
      serviceClient,
      withdrawalId,
      `A AbacatePay exige saques a partir de R$ ${centsToAmount(MIN_WITHDRAWAL_CENTS)
        .toFixed(2)
        .replace(".", ",")}.`,
      {
        validationReason: "minimum_withdrawal_amount",
      }
    );
  }

  const providerPayload = buildWithdrawalPixTransferPayload(context);
  if (!providerPayload?.pix?.key) {
    return failWithdrawalWithoutProviderCall(
      serviceClient,
      withdrawalId,
      "Nao foi possivel localizar a chave PIX cadastrada para o saque."
    );
  }

  const providerAttemptCount = (Number(context.withdrawalRow.provider_attempt_count) || 0) + 1;
  const providerRequestAudit = buildWithdrawalProviderRequestAudit(providerPayload, context);
  await persistPendingWithdrawalState({
    serviceClient,
    withdrawalId,
    status: "processing",
    providerRequest: providerRequestAudit,
    providerResponse: context.withdrawalRow.sanitized_provider_response || {},
    providerAttemptCount,
    providerLastError: null,
    providerLastHttpStatus: null,
    providerNextRetryAt: buildWithdrawalRetryAt(providerAttemptCount),
  });

  logWithdrawalEvent("provider_send_started", {
    withdrawalId,
    ownerId: context.withdrawalRow.owner_id,
    payoutMethodId: context.withdrawalRow.payout_method_id,
    amountCents: context.withdrawalRow.requested_amount_cents,
    providerAttemptCount,
    trigger: options.trigger || "request",
  });

  try {
    const providerResult = await sendPixTransfer(providerPayload);
    const providerResponse = buildWithdrawalProviderResponseAudit(providerResult);
    const resolution = mapAbacatepixTransferStatusToWithdrawalResolution(providerResponse.status);

    logWithdrawalEvent("provider_send_completed", {
      withdrawalId,
      ownerId: context.withdrawalRow.owner_id,
      providerReferenceId: providerResponse.id || null,
      providerStatus: providerResponse.status || null,
      resolution,
      providerAttemptCount,
    });

    if (!resolution) {
      return persistPendingWithdrawalState({
        serviceClient,
        withdrawalId,
        status: "provider_pending",
        providerRequest: providerRequestAudit,
        providerResponse,
        providerAttemptCount,
        providerNextRetryAt: buildWithdrawalRetryAt(providerAttemptCount),
      });
    }

    return finalizeWithdrawalFromProviderState({
      serviceClient,
      withdrawalId,
      providerResponse,
      resolution,
      failureReason: resolution === "succeeded" ? null : "Falha ao enviar PIX via AbacatePay.",
    });
  } catch (error) {
    const providerResponse = buildWithdrawalProviderResponseAudit(error?.providerData || {}, {
      errorMessage: error?.message || "pix_send_failed",
      httpStatus: error?.status || null,
      pendingReview: !error?.providerData,
    });

    logWithdrawalEvent(
      "provider_send_failed",
      {
        withdrawalId,
        ownerId: context.withdrawalRow.owner_id,
        providerStatus: providerResponse.status || null,
        httpStatus: error?.status || null,
        providerAttemptCount,
        transient: isTransientProviderError(error),
        message: error?.message || "pix_send_failed",
      },
      isTransientProviderError(error) ? "warn" : "error"
    );

    if (isProviderConfigurationError(error) && !error?.providerData) {
      return finalizeWithdrawalFromProviderState({
        serviceClient,
        withdrawalId,
        providerResponse,
        resolution: "failed",
        failureReason:
          "Saque nao enviado: a chave da AbacatePay nao esta configurada no backend.",
      });
    }

    await persistPendingWithdrawalState({
      serviceClient,
      withdrawalId,
      status: "processing",
      providerRequest: providerRequestAudit,
      providerResponse,
      providerAttemptCount,
      providerLastError: error?.message || "pix_send_failed",
      providerLastHttpStatus: error?.status || null,
      providerNextRetryAt: buildWithdrawalRetryAt(providerAttemptCount),
    }).catch(() => {});

    if (error?.providerData) {
      const resolution =
        mapAbacatepixTransferStatusToWithdrawalResolution(providerResponse.status) || "failed";
      return finalizeWithdrawalFromProviderState({
        serviceClient,
        withdrawalId,
        providerResponse,
        resolution,
        failureReason: error?.message || "Falha ao enviar PIX via AbacatePay.",
      });
    }

    const providerLookupResolution = await syncWithdrawalWithProviderLookup(
      serviceClient,
      context.withdrawalRow,
      {
        syncSource: "post_send_error_lookup",
      }
    );
    if (providerLookupResolution) {
      return providerLookupResolution;
    }

    const currentRow = await fetchWithdrawalRowById(serviceClient, withdrawalId);
    return currentRow ? mapWithdrawalRow(currentRow) : null;
  }
}

async function reconcilePendingWithdrawalsForOwners(ownerIds = []) {
  const uniqueOwnerIds = normalizeOwnerSet(ownerIds);
  if (!uniqueOwnerIds.length) return;

  const serviceClient = getServiceRoleClient();
  const { data, error } = await serviceClient
    .from("withdrawal_requests")
    .select(WITHDRAWAL_EXECUTION_SELECT)
    .in("owner_id", uniqueOwnerIds)
    .in("status", ["reserved", "processing", "provider_pending", "queued_manual_settlement"])
    .order("requested_at", { ascending: true })
    .limit(25);

  if (error) throw error;

  const nowTime = Date.now();
  for (const withdrawalRow of data || []) {
    if (!isActiveWithdrawalStatus(withdrawalRow.status)) continue;
    const nextRetryAt = withdrawalRow.provider_next_retry_at
      ? new Date(withdrawalRow.provider_next_retry_at).getTime()
      : null;
    if (nextRetryAt && Number.isFinite(nextRetryAt) && nextRetryAt > nowTime) continue;

    const providerLookupResult = await syncWithdrawalWithProviderLookup(serviceClient, withdrawalRow, {
      syncSource: "owner_read_reconciliation",
    });
    if (providerLookupResult) continue;

    await executeQueuedWithdrawalPixSend(withdrawalRow.id, {
      force: true,
      serviceClient,
      trigger: "owner_read_reconciliation",
    }).catch((reconciliationError) => {
      logWithdrawalEvent(
        "reconciliation_retry_failed",
        {
          withdrawalId: withdrawalRow.id,
          ownerId: withdrawalRow.owner_id,
          message: reconciliationError?.message || "reconciliation_retry_failed",
        },
        "warn"
      );
    });
  }
}

export async function processOwnerWithdrawalProviderWebhook({
  payload,
  eventType,
  eventRow = null,
} = {}) {
  const normalizedEventType =
    String(eventType || normalizeAbacatepayEventType(payload) || "")
      .trim()
      .toLowerCase();

  if (
    normalizedEventType !== "transfer.completed" &&
    normalizedEventType !== "transfer.failed" &&
    normalizedEventType !== "payout.completed" &&
    normalizedEventType !== "payout.done" &&
    normalizedEventType !== "payout.failed"
  ) {
    return { applied: false, reason: "unsupported_event" };
  }

  const serviceClient = getServiceRoleClient();
  const externalId = extractAbacatepayExternalId(payload);
  const providerReferenceId = sanitizePixTransferResponse(payload)?.id || null;
  const withdrawalRow = await fetchWithdrawalRowForProviderWebhook(serviceClient, {
    externalId,
    providerReferenceId,
  });
  if (!withdrawalRow) {
    return {
      applied: false,
      reason: externalId || providerReferenceId ? "withdrawal_not_found" : "missing_correlation",
      externalId,
      providerReferenceId,
    };
  }

  const currentStatus = String(withdrawalRow.status || "").trim().toLowerCase();
  if (isFinalWithdrawalStatus(currentStatus)) {
    return {
      applied: false,
      reason: "already_finalized",
      withdrawalId: withdrawalRow.id,
      status: currentStatus,
    };
  }

  const providerResponse = buildWithdrawalProviderResponseAudit(payload, {
    webhookEventType: normalizedEventType,
    webhookEventId: eventRow?.id || null,
  });
  const resolution =
    normalizedEventType.endsWith(".completed") || normalizedEventType.endsWith(".done")
      ? "succeeded"
      : mapAbacatepixTransferStatusToWithdrawalResolution(providerResponse.status) || "failed";
  const failureReason =
    resolution === "succeeded"
      ? null
      : payload?.reason ||
        payload?.error ||
        payload?.data?.reason ||
        "Falha ao enviar PIX via AbacatePay.";

  logWithdrawalEvent("provider_webhook_received", {
    withdrawalId: withdrawalRow.id,
    ownerId: withdrawalRow.owner_id,
    eventType: normalizedEventType,
    providerReferenceId: providerResponse.id || providerReferenceId || null,
    externalId: providerResponse.externalId || externalId || null,
    providerStatus: providerResponse.status || null,
    resolution,
  });

  const resolvedRow =
    resolution == null
      ? await persistPendingWithdrawalState({
          serviceClient,
          withdrawalId: withdrawalRow.id,
          status: "provider_pending",
          providerResponse,
          providerAttemptCount: Number(withdrawalRow.provider_attempt_count) || 0,
          providerLastEventType: normalizedEventType,
          providerNextRetryAt: buildWithdrawalRetryAt(withdrawalRow.provider_attempt_count),
        })
      : await finalizeWithdrawalFromProviderState({
          serviceClient,
          withdrawalId: withdrawalRow.id,
          resolution,
          failureReason,
          providerResponse,
        });

  return {
    applied: true,
    withdrawalId: resolvedRow?.id || withdrawalRow.id,
    ownerId: resolvedRow?.owner_id || withdrawalRow.owner_id,
    status: resolvedRow?.status || resolution || "provider_pending",
  };
}

export async function requestOwnerWithdrawal({
  ownerIds = [],
  payoutMethodId,
  amount,
  idempotencyKey,
  note = null,
} = {}) {
  const uniqueOwnerIds = normalizeOwnerSet(ownerIds);
  if (!uniqueOwnerIds.length) {
    throw Object.assign(new Error("Nenhum proprietario vinculado ao usuario autenticado."), {
      status: 403,
    });
  }

  if (!payoutMethodId) {
    throw Object.assign(new Error("Selecione um metodo PIX verificado."), { status: 400 });
  }

  const amountCents = parseCurrencyInputToCents(amount);
  if (amountCents < MIN_WITHDRAWAL_CENTS) {
    throw Object.assign(
      new Error(
        `O valor minimo para saque e R$ ${centsToAmount(MIN_WITHDRAWAL_CENTS)
          .toFixed(2)
          .replace(".", ",")}.`
      ),
      { status: 400 }
    );
  }

  const normalizedIdempotencyKey = String(idempotencyKey || "").trim();
  if (!normalizedIdempotencyKey) {
    throw Object.assign(new Error("A requisicao de saque precisa de uma chave de idempotencia."), {
      status: 400,
    });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("queue_owner_withdrawal_request", {
    p_payout_method_id: payoutMethodId,
    p_amount_cents: amountCents,
    p_idempotency_key: normalizedIdempotencyKey,
    p_request_metadata: {
      note: note || null,
    },
  });

  if (error) {
    throw Object.assign(new Error(mapWithdrawalRpcError(error)), { status: 400 });
  }

  const queuedWithdrawal = unwrapRpcSingleRow(data) || {};
  logWithdrawalEvent("withdrawal_requested", {
    withdrawalId: queuedWithdrawal?.id || null,
    ownerIds: uniqueOwnerIds,
    payoutMethodId,
    amountCents,
    idempotencyKey: normalizedIdempotencyKey,
    initialStatus: queuedWithdrawal?.status || null,
  });
  const withdrawal =
    queuedWithdrawal?.id && String(queuedWithdrawal?.status || "").trim().toLowerCase() !== "succeeded"
      ? await executeQueuedWithdrawalPixSend(queuedWithdrawal.id, {
          trigger: "request",
        })
      : mapWithdrawalRow(queuedWithdrawal);

  const wallet = await getOwnerWalletOverview({ ownerIds: uniqueOwnerIds });
  return { withdrawal, wallet };
}

export async function createOwnerPayoutMethod({
  ownerIds = [],
  ownerId = null,
  pixKeyType,
  pixKeyValue,
  holderName = null,
  holderTaxId = null,
  makeDefault = true,
  actorUserId = null,
} = {}) {
  const uniqueOwnerIds = normalizeOwnerSet(ownerIds);
  if (!uniqueOwnerIds.length) {
    throw Object.assign(new Error("Nenhum proprietario vinculado ao usuario autenticado."), {
      status: 403,
    });
  }

  const normalizedOwnerId = ownerId ? String(ownerId).trim() : uniqueOwnerIds[0];
  if (!normalizedOwnerId || !uniqueOwnerIds.includes(normalizedOwnerId)) {
    throw Object.assign(
      new Error("O proprietario selecionado nao pertence ao usuario autenticado."),
      {
        status: 403,
      }
    );
  }

  const normalizedPixKeyType = normalizePixKeyType(pixKeyType);
  const pixKeyValidation = validatePixKeyValue(pixKeyValue, normalizedPixKeyType);
  const normalizedPixKeyValue = pixKeyValidation.normalizedValue;
  if (!pixKeyValidation.valid) {
    throw Object.assign(new Error("Informe uma chave PIX valida para o tipo selecionado."), {
      status: 400,
    });
  }
  const normalizedHolderTaxId = holderTaxId ? normalizeTaxId(holderTaxId) : null;
  if (normalizedHolderTaxId && ![11, 14].includes(normalizedHolderTaxId.length)) {
    throw Object.assign(new Error("Informe um CPF ou CNPJ valido para o titular."), {
      status: 400,
    });
  }

  const serviceClient = getServiceRoleClient();
  const { data: ownerProfile, error: ownerError } = await serviceClient
    .from("owner_profiles")
    .select("id, organization_id")
    .eq("id", normalizedOwnerId)
    .maybeSingle();

  if (ownerError) throw ownerError;
  if (!ownerProfile) {
    throw Object.assign(new Error("Proprietario nao encontrado."), { status: 404 });
  }

  const shouldBeDefault = !!makeDefault;
  if (shouldBeDefault) {
    const { error: clearDefaultError } = await serviceClient
      .from("owner_payout_methods")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("owner_id", normalizedOwnerId)
      .eq("active", true);

    if (clearDefaultError) throw clearDefaultError;
  }

  const { data, error } = await serviceClient
    .from("owner_payout_methods")
    .insert({
      organization_id: ownerProfile.organization_id,
      owner_id: normalizedOwnerId,
      method: "PIX",
      pix_key_type: normalizedPixKeyType,
      pix_key_value: normalizedPixKeyValue,
      pix_key_masked: maskPixKey(normalizedPixKeyValue, normalizedPixKeyType),
      holder_name: holderName ? String(holderName).trim().slice(0, 255) : null,
      holder_tax_id: normalizedHolderTaxId ? normalizedHolderTaxId.slice(0, 32) : null,
      verification_status: "verified",
      active: true,
      is_default: shouldBeDefault,
      created_by_user_id: actorUserId,
      metadata: {
        createdVia: "owner_withdrawal_ui",
        autoVerified: true,
      },
    })
    .select(
      "id, owner_id, method, pix_key_type, pix_key_masked, verification_status, is_default, active, created_at"
    )
    .maybeSingle();

  if (error) throw error;

  const wallet = await getOwnerWalletOverview({ ownerIds: uniqueOwnerIds });
  return {
    payoutMethod: mapPayoutMethodRow(data || {}),
    wallet,
  };
}

export async function resolveOwnerWithdrawalManually({
  withdrawalId,
  resolution,
  failureReason = null,
  providerResponse = {},
} = {}) {
  if (!withdrawalId) {
    throw Object.assign(new Error("Informe o saque que sera resolvido."), { status: 400 });
  }

  const normalizedResolution = String(resolution || "").trim().toLowerCase();
  if (!["succeeded", "failed", "cancelled"].includes(normalizedResolution)) {
    throw Object.assign(new Error("Resolucao de saque invalida."), { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("resolve_owner_withdrawal_request", {
    p_withdrawal_id: withdrawalId,
    p_resolution: normalizedResolution,
    p_failure_reason: failureReason,
    p_provider_response: providerResponse || {},
  });

  if (error) {
    const message = String(error.message || "");
    if (message.includes("withdrawal settlement access denied")) {
      throw Object.assign(
        new Error("Somente administradores da organizacao podem concluir o saque."),
        {
          status: 403,
        }
      );
    }
    if (message.includes("withdrawal request not found")) {
      throw Object.assign(new Error("Saque nao encontrado."), { status: 404 });
    }
    if (message.includes("provider reference id required for succeeded resolution")) {
      throw Object.assign(
        new Error("Nao e permitido concluir o saque sem comprovacao do provider."),
        {
          status: 400,
        }
      );
    }
    throw Object.assign(new Error(error.message || "Nao foi possivel resolver o saque."), {
      status: 400,
    });
  }

  return mapWithdrawalRow(unwrapRpcSingleRow(data) || {});
}
