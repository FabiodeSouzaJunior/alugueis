import { getServiceRoleClient, getSupabaseClient } from "@/database/supabaseClient";
import {
  createTransparentPixCharge,
  getAbacatepayResponseApiVersion,
  sanitizeCheckoutPayload,
  validateAbacatepayWebhookRequest,
} from "@/server/modules/financial/abacatepay.service";
import {
  buildNormalizedWebhookEventKey,
  computeFundsAvailableAt,
  createRequestHash,
  centsToAmount,
  extractAbacatepayExternalId,
  extractAbacatepayPaymentMetadata,
  extractAbacatepayPaymentId,
  extractAbacatepayResource,
  extractAbacatepayResourceId,
  extractPaidAmountCents,
  extractPlatformFeeCents,
  extractReceiptUrl,
  extractResourceUpdatedAt,
  inferAbacatepayApiVersion,
  normalizeAbacatepayEventType,
} from "@/server/modules/financial/owner-wallet.utils";
import {
  buildPaymentProviderConfigSnapshot,
  getActivePaymentProviderConfigByOrganization,
  getPaymentProviderConfigById,
} from "@/features/pagamentos/provider-configs";
import {
  getDueDateForPeriod,
} from "@/lib/payment-dates";
import {
  resolveCalculatedPaymentStatus,
  resolveStoredPaymentDate,
} from "@/server/modules/financial/payment-automation.core";
import { processOwnerWithdrawalProviderWebhook } from "@/server/modules/financial/owner-wallet.service";

function normalizeSupabaseSingle(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

function nowIso() {
  return new Date().toISOString();
}

function centsFromDecimalAmount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed * 100));
}

function isDuplicateKeyError(error) {
  const message = String(error?.message || "");
  return error?.code === "23505" || /duplicate key/i.test(message);
}

const SUCCESS_EVENT_TYPES = new Set([
  "transparent.completed",
  "checkout.completed",
  "reconciliation.paid",
  "billing.paid",
]);

const REVERSAL_EVENT_TYPES = new Set([
  "transparent.refunded",
  "checkout.refunded",
  "transparent.disputed",
  "checkout.disputed",
  "billing.refunded",
]);

function normalizeOutstandingAmountCents(paymentRow) {
  const expectedAmount = Number(paymentRow?.expected_amount ?? paymentRow?.amount ?? 0);
  const currentPaidAmount = Number(paymentRow?.amount ?? 0);
  return Math.max(0, Math.round((expectedAmount - currentPaidAmount) * 100));
}

function buildCheckoutDescription(paymentRow, tenantRow) {
  const tenantName = tenantRow?.name || "Inquilino";
  const month = Number(paymentRow?.month);
  const year = Number(paymentRow?.year);
  if (month && year) {
    return `Aluguel ${String(month).padStart(2, "0")}/${year} - ${tenantName}`.slice(0, 120);
  }
  return `Pagamento de aluguel - ${tenantName}`.slice(0, 120);
}

function buildCheckoutCustomer(tenantRow) {
  const email = tenantRow?.email ? String(tenantRow.email).trim() : "";
  if (!email) return undefined;

  const customer = { email };
  if (tenantRow?.name) customer.name = tenantRow.name;
  if (tenantRow?.document_number) customer.taxId = tenantRow.document_number;
  if (tenantRow?.phone) customer.cellphone = tenantRow.phone;
  return customer;
}

function mapCheckoutRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    paymentId: row.payment_id,
    tenantId: row.tenant_id,
    status: row.status,
    providerStatus: row.provider_status,
    providerCheckoutId: row.provider_checkout_id,
    providerExternalId: row.provider_external_id,
    checkoutMode: row.checkout_mode,
    amountBaseCents: Math.round(Number(row.amount_base || 0) * 100),
    amountBase: Number(row.amount_base || 0),
    amountFeeCents: Math.round(Number(row.amount_fee || 0) * 100),
    amountFee: Number(row.amount_fee || 0),
    amountTotalCents: Math.round(Number(row.amount_total || 0) * 100),
    amountTotal: Number(row.amount_total || 0),
    providerPaymentMethod: row.provider_payment_method || null,
    reusableUntil: row.reusable_until || null,
    receiptUrl: row.response_payload?.receiptUrl || row.response_payload?.data?.receiptUrl || null,
    brCode: row.response_payload?.brCode || row.response_payload?.data?.brCode || null,
    brCodeBase64:
      row.response_payload?.brCodeBase64 || row.response_payload?.data?.brCodeBase64 || null,
    paidAt: row.paid_at || null,
    metadata: row.metadata || {},
    provider: {
      configId: row.provider_config_id || null,
      accountId: row.provider_account_id || null,
      environment: row.provider_environment || null,
    },
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function readAccessiblePayment(paymentId) {
  const supabase = getSupabaseClient();
  const { data: paymentRow, error: paymentError } = await supabase
    .from("payments")
    .select("id, tenant_id, month, year, amount, expected_amount, due_date, status, organization_id")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentError) throw paymentError;
  if (!paymentRow) return null;

  const { data: tenantRow, error: tenantError } = await supabase
    .from("tenants")
    .select("id, name, email, phone, document_number, property_id, organization_id, payment_day")
    .eq("id", paymentRow.tenant_id)
    .maybeSingle();

  if (tenantError) throw tenantError;

  return {
    paymentRow,
    tenantRow: tenantRow || null,
  };
}

async function readCheckoutByRequestHash(serviceClient, requestHash) {
  const { data, error } = await serviceClient
    .from("payment_gateway_checkouts")
    .select("*")
    .eq("provider", "abacatepay")
    .eq("request_hash", requestHash)
    .in("status", ["creating", "ready"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function insertCreatingCheckoutRecord(serviceClient, record) {
  const { data, error } = await serviceClient
    .from("payment_gateway_checkouts")
    .insert(record)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function updateCheckoutRecord(serviceClient, checkoutId, patch) {
  const { data, error } = await serviceClient
    .from("payment_gateway_checkouts")
    .update({
      ...patch,
      updated_at: nowIso(),
    })
    .eq("id", checkoutId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

function resolveSettledPaymentAmountCents(paymentRow, checkoutRow, payload) {
  const checkoutBaseCents = centsFromDecimalAmount(checkoutRow?.amount_base);
  if (checkoutBaseCents != null) return checkoutBaseCents;

  const metadataBaseCents = Number(
    checkoutRow?.metadata?.baseAmountCents ??
      payload?.data?.metadata?.baseAmountCents ??
      payload?.metadata?.baseAmountCents
  );
  if (Number.isFinite(metadataBaseCents) && metadataBaseCents >= 0) {
    return Math.round(metadataBaseCents);
  }

  const expectedAmountCents = centsFromDecimalAmount(
    paymentRow?.expected_amount ?? paymentRow?.amount ?? 0
  );
  const currentPaidCents = centsFromDecimalAmount(paymentRow?.amount ?? 0) ?? 0;
  if (expectedAmountCents != null) {
    return Math.max(expectedAmountCents - currentPaidCents, 0);
  }

  return extractPaidAmountCents(payload);
}

export async function getLatestPaymentCheckout(paymentId) {
  const context = await readAccessiblePayment(paymentId);
  if (!context) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("payment_gateway_checkouts")
    .select("*")
    .eq("payment_id", paymentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapCheckoutRow(data) : null;
}

export async function createPaymentTransparentCheckout({
  paymentId,
  authUserId = null,
} = {}) {
  const context = await readAccessiblePayment(paymentId);
  if (!context) {
    throw Object.assign(new Error("Pagamento não encontrado."), { status: 404 });
  }

  const { paymentRow, tenantRow } = context;
  const openAmountCents = normalizeOutstandingAmountCents(paymentRow);
  if (openAmountCents <= 0) {
    throw Object.assign(new Error("Este pagamento já está quitado."), { status: 409 });
  }

  const organizationId = paymentRow.organization_id || tenantRow?.organization_id || null;
  const providerConfig = await getActivePaymentProviderConfigByOrganization(
    organizationId,
    "abacatepay"
  );

  const requestHash = createRequestHash([
    paymentRow.id,
    paymentRow.tenant_id,
    paymentRow.expected_amount,
    paymentRow.amount,
    paymentRow.month,
    paymentRow.year,
    "transparent_auto",
    providerConfig.id,
    providerConfig.providerAccountId,
    providerConfig.environment,
  ]);

  const serviceClient = getServiceRoleClient();
  const reusable = await readCheckoutByRequestHash(serviceClient, requestHash);
  if (reusable) {
    const reusableUntil = reusable.reusable_until ? new Date(reusable.reusable_until) : null;
    if (!reusableUntil || reusableUntil.getTime() > Date.now()) {
      return mapCheckoutRow(reusable);
    }
  }

  const creatingRecord = {
    provider: "abacatepay",
    payment_id: paymentRow.id,
    tenant_id: paymentRow.tenant_id,
    organization_id: organizationId,
    requested_by_user_id: authUserId,
    provider_config_id: providerConfig.id,
    provider_account_id: providerConfig.providerAccountId,
    provider_environment: providerConfig.environment,
    provider_config_snapshot: buildPaymentProviderConfigSnapshot(providerConfig),
    request_hash: requestHash,
    checkout_mode: "pix_qr",
    status: "creating",
    provider_status: "CREATING",
    amount_base: centsToAmount(openAmountCents),
    amount_fee: 0,
    amount_total: centsToAmount(openAmountCents),
    currency: "BRL",
    request_payload: {
      version: "auto",
      type: "transparent",
      paymentId: paymentRow.id,
      tenantId: paymentRow.tenant_id,
      providerConfigId: providerConfig.id,
      providerAccountId: providerConfig.providerAccountId,
      providerEnvironment: providerConfig.environment,
      openAmountCents,
    },
    response_payload: {},
    metadata: {
      paymentId: paymentRow.id,
      tenantId: paymentRow.tenant_id,
      organizationId,
      providerConfigId: providerConfig.id,
      providerAccountId: providerConfig.providerAccountId,
      providerEnvironment: providerConfig.environment,
      month: paymentRow.month,
      year: paymentRow.year,
    },
  };

  let checkoutRow = null;
  try {
    checkoutRow = await insertCreatingCheckoutRecord(serviceClient, creatingRecord);
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const duplicatedRow = await readCheckoutByRequestHash(serviceClient, requestHash);
    if (duplicatedRow) return mapCheckoutRow(duplicatedRow);
    throw error;
  }

  try {
    const externalResponse = await createTransparentPixCharge({
      amountCents: openAmountCents,
      description: buildCheckoutDescription(paymentRow, tenantRow),
      expiresInSeconds: 1800,
      customer: buildCheckoutCustomer(tenantRow),
      providerConfig,
      metadata: {
        paymentId: paymentRow.id,
        tenantId: paymentRow.tenant_id,
        organizationId,
        providerConfigId: providerConfig.id,
        providerAccountId: providerConfig.providerAccountId,
        providerEnvironment: providerConfig.environment,
      },
    });

    const providerPayload = sanitizeCheckoutPayload(externalResponse);
    const providerApiVersion = getAbacatepayResponseApiVersion(externalResponse) || 2;
    const updatedRow = await updateCheckoutRecord(serviceClient, checkoutRow.id, {
      status: "ready",
      provider_status: providerPayload.status || "PENDING",
      provider_checkout_id: providerPayload.id,
      provider_external_id: paymentRow.id,
      provider_api_version: providerApiVersion,
      provider_payment_method: "PIX",
      amount_fee: centsToAmount(providerPayload.platformFee || 0),
      amount_total: centsToAmount(providerPayload.amount || openAmountCents),
      reusable_until: providerPayload.expiresAt || null,
      request_payload: {
        ...creatingRecord.request_payload,
        version: providerApiVersion,
      },
      response_payload: providerPayload,
      metadata: {
        ...creatingRecord.metadata,
        receiptUrl: providerPayload.receiptUrl || null,
      },
    });

    return mapCheckoutRow(updatedRow);
  } catch (error) {
    await updateCheckoutRecord(serviceClient, checkoutRow.id, {
      status: "failed",
      provider_status: "FAILED",
      error_message: error.message || "Não foi possível criar o checkout transparente.",
      last_error_at: nowIso(),
    }).catch(() => {});
    throw Object.assign(
      new Error(error.message || "Não foi possível criar o QR Code PIX."),
      { status: error.status || 502 }
    );
  }
}

async function resolvePaymentOwnerContext(serviceClient, paymentId, tenantId) {
  const { data: paymentRow, error: paymentError } = await serviceClient
    .from("payments")
    .select("id, tenant_id, amount, expected_amount, due_date, status, organization_id, month, year")
    .eq("id", paymentId)
    .maybeSingle();
  if (paymentError) throw paymentError;
  if (!paymentRow) return null;

  const { data: tenantRow, error: tenantError } = await serviceClient
    .from("tenants")
    .select("id, property_id, organization_id, payment_day")
    .eq("id", tenantId || paymentRow.tenant_id)
    .maybeSingle();
  if (tenantError) throw tenantError;
  if (!tenantRow) return null;

  let unitRow = null;
  const unitQuery = await serviceClient
    .from("property_units")
    .select("id, property_id, tenant_id, resident_tenant_id")
    .or(`tenant_id.eq.${tenantRow.id},resident_tenant_id.eq.${tenantRow.id}`)
    .limit(1)
    .maybeSingle();
  if (!unitQuery.error) unitRow = unitQuery.data || null;

  if (!unitRow) {
    const residentLink = await serviceClient
      .from("property_unit_residents")
      .select("unit_id")
      .eq("tenant_id", tenantRow.id)
      .limit(1)
      .maybeSingle();

    if (!residentLink.error && residentLink.data?.unit_id) {
      const fallbackUnit = await serviceClient
        .from("property_units")
        .select("id, property_id")
        .eq("id", residentLink.data.unit_id)
        .maybeSingle();
      if (!fallbackUnit.error) unitRow = fallbackUnit.data || null;
    }
  }

  const propertyId = unitRow?.property_id || tenantRow.property_id || null;
  if (!propertyId) {
    return {
      paymentRow,
      tenantRow,
      unitRow,
      propertyId: null,
      ownerLink: null,
    };
  }

  const { data: ownerLink, error: ownerError } = await serviceClient
    .from("owner_property_links")
    .select("owner_id, organization_id")
    .eq("property_id", propertyId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (ownerError) throw ownerError;

  return {
    paymentRow,
    tenantRow,
    unitRow,
    propertyId,
    ownerLink: ownerLink || null,
  };
}

async function refreshWalletSummary(serviceClient, ownerId) {
  const { error } = await serviceClient.rpc("refresh_owner_wallet_summary", {
    p_owner_id: ownerId,
  });
  if (error) throw error;
}

function buildPortalCreditIdempotencyKey(paymentId, checkoutRow = null, eventRow = null, payload = {}) {
  const providerCheckoutId =
    checkoutRow?.provider_checkout_id ||
    extractAbacatepayResourceId(payload) ||
    checkoutRow?.response_payload?.id ||
    null;
  const checkoutId = checkoutRow?.id || null;
  const eventId = eventRow?.id || null;
  const fallbackKey = createRequestHash([paymentId, checkoutId, eventId, providerCheckoutId, payload]);
  return [
    "payment-allocation",
    paymentId,
    providerCheckoutId || checkoutId || eventId || fallbackKey,
  ].join(":");
}

async function upsertProcessedWebhook(serviceClient, eventId, patch) {
  const { error } = await serviceClient
    .from("payment_gateway_webhook_events")
    .update({
      ...patch,
      processed_at: patch.processed_at ?? nowIso(),
    })
    .eq("id", eventId);

  if (error) throw error;
}

async function applySuccessfulWalletCredit({
  serviceClient,
  eventRow,
  paymentContext,
  checkoutRow,
  payload,
  skipPaymentMutation = false,
} = {}) {
  if (!paymentContext?.ownerLink?.owner_id || !paymentContext.propertyId) {
    return { applied: false, reason: "no_active_owner_link" };
  }

  const amountCents = extractPaidAmountCents(payload);
  const settledPaymentAmountCents = resolveSettledPaymentAmountCents(
    paymentContext.paymentRow,
    checkoutRow,
    payload
  );
  const checkoutFeeCents =
    checkoutRow && Number.isFinite(Number(checkoutRow.amount_fee))
      ? Math.max(0, Math.round(Number(checkoutRow.amount_fee) * 100))
      : null;
  const webhookFeeCents = extractPlatformFeeCents(payload);
  const gatewayFeeCents = checkoutFeeCents != null ? checkoutFeeCents : webhookFeeCents;
  const netAmountCents = Math.max(amountCents - gatewayFeeCents, 0);
  const paidAt = extractResourceUpdatedAt(payload) || nowIso();
  const availableAt = computeFundsAvailableAt(paidAt);
  const allocationKey = buildPortalCreditIdempotencyKey(
    paymentContext.paymentRow.id,
    checkoutRow,
    eventRow,
    payload
  );

  const allocationPayload = {
    organization_id: paymentContext.ownerLink.organization_id,
    owner_id: paymentContext.ownerLink.owner_id,
    payment_id: paymentContext.paymentRow.id,
    tenant_id: paymentContext.tenantRow.id,
      property_id: paymentContext.propertyId,
      unit_id: paymentContext.unitRow?.id || null,
      payment_gateway_checkout_id: checkoutRow?.id || null,
      webhook_event_id: eventRow?.id || null,
      gross_amount_cents: amountCents,
      gateway_fee_cents: gatewayFeeCents,
      platform_fee_cents: 0,
    net_amount_cents: netAmountCents,
    paid_at: paidAt,
    available_at: availableAt,
    allocation_status: "applied",
    idempotency_key: allocationKey,
    metadata: {
      eventType: eventRow?.event_type || "backfill.reconciliation.paid",
      providerCheckoutId: checkoutRow?.provider_checkout_id || null,
      receiptUrl: extractReceiptUrl(payload),
      paymentOrigin: "tenant_portal",
    },
  };

  let allocationRow = null;
  try {
    const { data, error } = await serviceClient
      .from("payment_allocations")
      .insert(allocationPayload)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    allocationRow = data;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;

    const existing = await serviceClient
      .from("payment_allocations")
      .select("*")
      .eq("idempotency_key", allocationKey)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data?.id) {
      return { applied: false, reason: "allocation_exists", allocation: existing.data || null };
    }

    throw error;
  }

  const ledgerRows = [
    {
      owner_id: paymentContext.ownerLink.owner_id,
      organization_id: paymentContext.ownerLink.organization_id,
      payment_allocation_id: allocationRow.id,
      payment_id: paymentContext.paymentRow.id,
      checkout_id: checkoutRow?.id || null,
      webhook_event_id: eventRow?.id || null,
      entry_type: "payment_credit",
      direction: "credit",
      status: "posted",
      amount_cents: amountCents,
      available_at: availableAt,
      correlation_id: allocationRow.correlation_id,
      idempotency_key: `ledger:payment-credit:${allocationKey}`,
      source: "tenant_portal",
      metadata: {
        receiptUrl: extractReceiptUrl(payload),
        paidAt,
        paymentOrigin: "tenant_portal",
      },
    },
  ];

  if (gatewayFeeCents > 0) {
    ledgerRows.push({
      owner_id: paymentContext.ownerLink.owner_id,
      organization_id: paymentContext.ownerLink.organization_id,
      payment_allocation_id: allocationRow.id,
      payment_id: paymentContext.paymentRow.id,
      checkout_id: checkoutRow?.id || null,
      webhook_event_id: eventRow?.id || null,
      entry_type: "gateway_fee_debit",
      direction: "debit",
      status: "posted",
      amount_cents: gatewayFeeCents,
      correlation_id: allocationRow.correlation_id,
      idempotency_key: `ledger:gateway-fee:${allocationKey}`,
      source: "tenant_portal",
      metadata: {
        paidAt,
        paymentOrigin: "tenant_portal",
      },
    });
  }

  const { error: ledgerError } = await serviceClient.from("wallet_ledger").insert(ledgerRows);
  if (ledgerError && !isDuplicateKeyError(ledgerError)) throw ledgerError;

  const currentPaid = Number(paymentContext.paymentRow.amount || 0);
  const expectedAmount = Number(
    paymentContext.paymentRow.expected_amount ?? paymentContext.paymentRow.amount ?? 0
  );
  const dueDate =
    paymentContext.paymentRow.due_date ||
    getDueDateForPeriod(
      paymentContext.paymentRow.month,
      paymentContext.paymentRow.year,
      paymentContext.tenantRow.payment_day
    );

  if (!skipPaymentMutation) {
    const nextAmount = currentPaid + centsToAmount(settledPaymentAmountCents);
    const clampedAmount =
      expectedAmount > 0 ? Math.min(nextAmount, expectedAmount) : nextAmount;
    const nextStatus = resolveCalculatedPaymentStatus({
      paymentDate: paidAt,
      dueDate,
      amount: clampedAmount,
      expectedAmount,
    });

    await serviceClient
      .from("payments")
      .update({
        amount: clampedAmount,
        payment_date: resolveStoredPaymentDate({
          status: nextStatus,
          dueDate,
        }),
        status: nextStatus,
        updated_at: nowIso(),
      })
      .eq("id", paymentContext.paymentRow.id);
  }

  await refreshWalletSummary(serviceClient, paymentContext.ownerLink.owner_id);

  return {
    applied: true,
    allocation: allocationRow,
    ownerId: paymentContext.ownerLink.owner_id,
  };
}

export async function reconcileMissingWalletCredits({ ownerIds = [] } = {}) {
  const normalizedOwnerIds = Array.from(new Set((ownerIds || []).map(String).filter(Boolean)));
  if (!normalizedOwnerIds.length) return { repaired: 0, scanned: 0 };

  const serviceClient = getServiceRoleClient();
  const { data: paidCheckoutRows, error } = await serviceClient
    .from("payment_gateway_checkouts")
    .select(
      "id, payment_id, tenant_id, organization_id, status, provider_status, provider_checkout_id, amount_base, amount_fee, amount_total, response_payload, metadata, created_at, updated_at"
    )
    .eq("status", "paid");

  if (error) throw error;

  let repaired = 0;

  for (const checkoutRow of paidCheckoutRows || []) {
    if (!checkoutRow?.payment_id) continue;
    const allocationKey = buildPortalCreditIdempotencyKey(
      checkoutRow.payment_id,
      checkoutRow,
      null,
      checkoutRow?.response_payload || {}
    );

    const { data: existingAllocation, error: allocationError } = await serviceClient
      .from("payment_allocations")
      .select("id")
      .eq("idempotency_key", allocationKey)
      .maybeSingle();
    if (allocationError) throw allocationError;
    if (existingAllocation?.id) continue;

    if (checkoutRow?.id) {
      const { data: existingCheckoutAllocation, error: checkoutAllocationError } =
        await serviceClient
          .from("payment_allocations")
          .select("id")
          .eq("payment_gateway_checkout_id", checkoutRow.id)
          .maybeSingle();
      if (checkoutAllocationError) throw checkoutAllocationError;
      if (existingCheckoutAllocation?.id) continue;
    }

    const paymentContext = await resolvePaymentOwnerContext(
      serviceClient,
      checkoutRow.payment_id,
      checkoutRow.tenant_id
    );
    const ownerId = paymentContext?.ownerLink?.owner_id || null;
    if (!ownerId || !normalizedOwnerIds.includes(String(ownerId))) continue;

    const currentPaidCents = centsFromDecimalAmount(paymentContext?.paymentRow?.amount ?? 0) ?? 0;
    const expectedAmountCents =
      centsFromDecimalAmount(
        paymentContext?.paymentRow?.expected_amount ?? paymentContext?.paymentRow?.amount ?? 0
      ) ?? 0;
    const checkoutBaseCents = resolveSettledPaymentAmountCents(
      paymentContext?.paymentRow,
      checkoutRow,
      checkoutRow?.response_payload || {}
    );
    const skipPaymentMutation =
      currentPaidCents >= checkoutBaseCents ||
      (expectedAmountCents > 0 && currentPaidCents >= expectedAmountCents);

    const result = await applySuccessfulWalletCredit({
      serviceClient,
      eventRow: null,
      paymentContext,
      checkoutRow,
      payload: checkoutRow.response_payload || {},
      skipPaymentMutation,
    });

    if (result?.applied) repaired += 1;
  }

  return {
    repaired,
    scanned: toNumber(paidCheckoutRows?.length),
  };
}

async function getOutstandingDisputeHold(serviceClient, paymentId) {
  const { data, error } = await serviceClient
    .from("wallet_ledger")
    .select("entry_type, direction, amount_cents")
    .eq("payment_id", paymentId)
    .in("entry_type", ["dispute_hold", "dispute_release"]);

  if (error) throw error;

  return toNumber(
    (data || []).reduce((sum, row) => {
      const amount = Number(row.amount_cents) || 0;
      return sum + (row.direction === "debit" ? amount : -amount);
    }, 0)
  );
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function applyReversalOrHold({
  serviceClient,
  eventRow,
  paymentId,
  checkoutRow,
  payload,
  eventType,
} = {}) {
  const { data: allocationRow, error: allocationError } = await serviceClient
    .from("payment_allocations")
    .select("*")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (allocationError) throw allocationError;
  if (!allocationRow) {
    return { applied: false, reason: "allocation_missing" };
  }

  const ledgerRows = [];
  const idempotencyPrefix = `${eventType}:${paymentId}`;

  if (eventType.endsWith(".disputed")) {
    ledgerRows.push({
      owner_id: allocationRow.owner_id,
      organization_id: allocationRow.organization_id,
      payment_allocation_id: allocationRow.id,
      payment_id: paymentId,
      checkout_id: checkoutRow?.id || allocationRow.payment_gateway_checkout_id,
      webhook_event_id: eventRow.id,
      entry_type: "dispute_hold",
      direction: "debit",
      status: "blocked",
      amount_cents: allocationRow.net_amount_cents,
      correlation_id: allocationRow.correlation_id,
      idempotency_key: `ledger:${idempotencyPrefix}:hold`,
      source: "abacatepay_webhook",
      metadata: {
        eventType,
      },
    });
  } else {
    const outstandingHold = await getOutstandingDisputeHold(serviceClient, paymentId);
    if (outstandingHold > 0) {
      ledgerRows.push({
        owner_id: allocationRow.owner_id,
        organization_id: allocationRow.organization_id,
        payment_allocation_id: allocationRow.id,
        payment_id: paymentId,
        checkout_id: checkoutRow?.id || allocationRow.payment_gateway_checkout_id,
        webhook_event_id: eventRow.id,
        entry_type: "dispute_release",
        direction: "credit",
        status: "released",
        amount_cents: outstandingHold,
        correlation_id: allocationRow.correlation_id,
        idempotency_key: `ledger:${idempotencyPrefix}:release-hold`,
        source: "abacatepay_webhook",
        metadata: {
          eventType,
        },
      });
    }

    ledgerRows.push({
      owner_id: allocationRow.owner_id,
      organization_id: allocationRow.organization_id,
      payment_allocation_id: allocationRow.id,
      payment_id: paymentId,
      checkout_id: checkoutRow?.id || allocationRow.payment_gateway_checkout_id,
      webhook_event_id: eventRow.id,
      entry_type: eventType.endsWith(".refunded") ? "refund_debit" : "chargeback_debit",
      direction: "debit",
      status: "posted",
      amount_cents: allocationRow.net_amount_cents,
      correlation_id: allocationRow.correlation_id,
      idempotency_key: `ledger:${idempotencyPrefix}:debit`,
      source: "abacatepay_webhook",
      metadata: {
        eventType,
      },
    });

    await serviceClient
      .from("payment_allocations")
      .update({
        allocation_status: "reversed",
        updated_at: nowIso(),
      })
      .eq("id", allocationRow.id);
  }

  const { error: ledgerError } = await serviceClient.from("wallet_ledger").insert(ledgerRows);
  if (ledgerError && !isDuplicateKeyError(ledgerError)) throw ledgerError;

  if (eventType.endsWith(".refunded")) {
    const paymentContext = await resolvePaymentOwnerContext(
      serviceClient,
      paymentId,
      allocationRow.tenant_id
    );
    if (paymentContext?.paymentRow) {
      const refundedAmount = allocationRow.gross_amount_cents;
      const currentPaid = Number(paymentContext.paymentRow.amount || 0);
      const expectedAmount = Number(
        paymentContext.paymentRow.expected_amount ?? paymentContext.paymentRow.amount ?? 0
      );
      const dueDate =
        paymentContext.paymentRow.due_date ||
        getDueDateForPeriod(
          paymentContext.paymentRow.month,
          paymentContext.paymentRow.year,
          paymentContext.tenantRow?.payment_day
        );
      const nextAmount = Math.max(0, currentPaid - centsToAmount(refundedAmount));
      const nextStatus = resolveCalculatedPaymentStatus({
        paymentDate: nextAmount > 0 ? paymentContext.paymentRow.payment_date : null,
        dueDate,
        amount: nextAmount,
        expectedAmount,
      });

      await serviceClient
        .from("payments")
        .update({
          amount: nextAmount,
          payment_date: resolveStoredPaymentDate({
            status: nextStatus,
            dueDate,
          }),
          status: nextStatus,
          updated_at: nowIso(),
        })
        .eq("id", paymentId);
    }
  }

  await refreshWalletSummary(serviceClient, allocationRow.owner_id);

  return {
    applied: true,
    ownerId: allocationRow.owner_id,
    allocationId: allocationRow.id,
  };
}

async function insertWebhookEvent(serviceClient, row) {
  try {
    const { data, error } = await serviceClient
      .from("payment_gateway_webhook_events")
      .insert(row)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return { eventRow: data, duplicate: false };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;

    let existingEvent = null;
    let existingError = null;

    if (row.normalized_event_key) {
      const existingByKey = await serviceClient
        .from("payment_gateway_webhook_events")
        .select("*")
        .eq("normalized_event_key", row.normalized_event_key)
        .maybeSingle();
      existingEvent = existingByKey.data || null;
      existingError = existingByKey.error || null;
    }

    if (!existingEvent && row.provider_event_id) {
      let providerEventQuery = serviceClient
        .from("payment_gateway_webhook_events")
        .select("*")
        .eq("provider", row.provider)
        .eq("provider_event_id", row.provider_event_id);

      providerEventQuery = row.provider_config_id
        ? providerEventQuery.eq("provider_config_id", row.provider_config_id)
        : providerEventQuery.is("provider_config_id", null);

      const existingByProviderEventId = await providerEventQuery.maybeSingle();
      existingEvent = existingByProviderEventId.data || null;
      existingError = existingError || existingByProviderEventId.error || null;
    }

    if (existingError) throw existingError;

    if (existingEvent?.id) {
      await serviceClient
        .from("payment_gateway_webhook_events")
        .update({
          attempt_count: (existingEvent?.attempt_count || 1) + 1,
        })
        .eq("id", existingEvent.id)
        .catch(() => {});
    }

    if (!existingEvent) {
      throw error;
    }

    return { eventRow: existingEvent, duplicate: true };
  }
}

function normalizeHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers || {}).map(([key, value]) => [String(key || "").toLowerCase(), value])
  );
}

function normalizeProviderConfigId(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function extractProviderConfigIdFromWebhookInput({ payload = {}, headers = {}, queryParams = {} } = {}) {
  const normalizedHeaders = normalizeHeaders(headers);
  const metadata = extractAbacatepayPaymentMetadata(payload);

  return normalizeProviderConfigId(
    queryParams.providerConfigId ||
      queryParams.provider_config_id ||
      normalizedHeaders["x-provider-config-id"] ||
      normalizedHeaders["x-abacatepay-provider-config-id"] ||
      metadata?.providerConfigId ||
      metadata?.provider_config_id ||
      payload?.providerConfigId ||
      payload?.provider_config_id
  );
}

function buildWebhookProviderConfigFields(providerConfig = null) {
  return {
    provider_config_id: providerConfig?.id || null,
    provider_account_id: providerConfig?.providerAccountId || null,
    provider_environment: providerConfig?.environment || null,
  };
}

async function loadWebhookProviderConfig(configId) {
  const normalizedConfigId = normalizeProviderConfigId(configId);
  if (!normalizedConfigId) return null;
  return getPaymentProviderConfigById(normalizedConfigId, "abacatepay");
}

async function resolveWebhookProviderConfig({
  payload = {},
  headers = {},
  queryParams = {},
  checkoutRow = null,
  withdrawalRow = null,
  isWithdrawalTransferEvent = false,
} = {}) {
  const inputProviderConfigId = extractProviderConfigIdFromWebhookInput({
    payload,
    headers,
    queryParams,
  });
  const recordProviderConfigId =
    withdrawalRow?.provider_config_id || checkoutRow?.provider_config_id || null;
  const providerConfigId = recordProviderConfigId || inputProviderConfigId;

  if (!providerConfigId) {
    if (isWithdrawalTransferEvent) {
      throw Object.assign(new Error("Webhook de payout sem configuracao vinculada ao saque."), {
        status: 401,
        code: "provider_config_missing_on_withdrawal_webhook",
      });
    }
    return null;
  }

  if (
    recordProviderConfigId &&
    inputProviderConfigId &&
    String(recordProviderConfigId) !== String(inputProviderConfigId)
  ) {
    throw Object.assign(new Error("Webhook recebido com providerConfigId divergente."), {
      status: 401,
      code: "provider_config_mismatch",
    });
  }

  const providerConfig = await loadWebhookProviderConfig(providerConfigId);
  const organizationId =
    withdrawalRow?.organization_id || checkoutRow?.organization_id || providerConfig?.organizationId || null;
  if (
    organizationId &&
    providerConfig?.organizationId &&
    String(organizationId) !== String(providerConfig.organizationId)
  ) {
    throw Object.assign(new Error("Webhook recebido para configuracao de outra organizacao."), {
      status: 401,
      code: "provider_config_organization_mismatch",
    });
  }

  return providerConfig;
}

function validateWebhookWithProviderConfig({
  rawBody,
  headers,
  signatureFromHeader,
  providedSecret,
  providerConfig = null,
  webhookSecretValid,
  signatureValid,
  isWithdrawalTransferEvent = false,
} = {}) {
  if (providerConfig?.id) {
    return validateAbacatepayWebhookRequest({
      rawBody,
      headers,
      signatureFromHeader,
      providedSecret,
      expectedSecret: providerConfig.webhookSecret || "",
      expectedPublicKey: providerConfig.webhookPublicKey || "",
    });
  }

  if (typeof webhookSecretValid === "boolean" || typeof signatureValid === "boolean") {
    return {
      webhookSecretConfigured: null,
      webhookSecretProvided: !!providedSecret,
      webhookSecretValid: !!webhookSecretValid,
      webhookSecretSkipped: false,
      signatureValid: !!signatureValid,
      signatureKeyConfigured: null,
      allowed: !!webhookSecretValid && !!signatureValid,
    };
  }

  if (isWithdrawalTransferEvent) {
    return {
      webhookSecretConfigured: false,
      webhookSecretProvided: !!providedSecret,
      webhookSecretValid: false,
      webhookSecretSkipped: false,
      signatureValid: false,
      signatureKeyConfigured: false,
      allowed: false,
    };
  }

  return validateAbacatepayWebhookRequest({
    rawBody,
    headers,
    signatureFromHeader,
    providedSecret,
  });
}

export async function processAbacatepayWebhook({
  payload,
  rawBody,
  headers,
  queryParams,
  webhookSecretValid,
  signatureValid,
  signatureFromHeader = null,
  providedSecret = "",
} = {}) {
  const serviceClient = getServiceRoleClient();
  const eventType = normalizeAbacatepayEventType(payload);
  const isWithdrawalTransferEvent =
    eventType === "transfer.completed" ||
    eventType === "transfer.failed" ||
    eventType === "payout.completed" ||
    eventType === "payout.done" ||
    eventType === "payout.failed" ||
    eventType === "withdraw.completed" ||
    eventType === "withdraw.done" ||
    eventType === "withdraw.failed";
  const providerEventId = payload?.id || null;
  const providerCheckoutId = isWithdrawalTransferEvent ? null : extractAbacatepayResourceId(payload);
  const paymentId = isWithdrawalTransferEvent ? null : extractAbacatepayPaymentId(payload);
  const externalId = extractAbacatepayExternalId(payload);

  let checkoutRow = null;
  if (providerCheckoutId) {
    const checkoutLookup = await serviceClient
      .from("payment_gateway_checkouts")
      .select("*")
      .eq("provider_checkout_id", providerCheckoutId)
      .maybeSingle();
    if (!checkoutLookup.error) checkoutRow = checkoutLookup.data || null;
  }

  let withdrawalRow = null;

  let paymentIdToUse = paymentId || checkoutRow?.payment_id || null;
  let tenantIdToUse = checkoutRow?.tenant_id || null;
  let organizationIdToUse = checkoutRow?.organization_id || null;

  if (isWithdrawalTransferEvent && externalId) {
    const withdrawalLookup = await serviceClient
      .from("withdrawal_requests")
      .select(
        "id, organization_id, owner_id, provider_config_id, provider_account_id, provider_environment"
      )
      .eq("id", externalId)
      .maybeSingle();

    if (!withdrawalLookup.error && withdrawalLookup.data) {
      withdrawalRow = withdrawalLookup.data;
      organizationIdToUse = organizationIdToUse || withdrawalRow.organization_id || null;
    }
  }

  if (paymentIdToUse) {
    const paymentLookup = await serviceClient
      .from("payments")
      .select("id, tenant_id, organization_id")
      .eq("id", paymentIdToUse)
      .maybeSingle();
    if (!paymentLookup.error && paymentLookup.data) {
      tenantIdToUse = tenantIdToUse || paymentLookup.data.tenant_id;
      organizationIdToUse = organizationIdToUse || paymentLookup.data.organization_id;
    }
  }

  let providerConfig = null;
  let validation = null;
  try {
    providerConfig = await resolveWebhookProviderConfig({
      payload,
      headers,
      queryParams,
      checkoutRow,
      withdrawalRow,
      isWithdrawalTransferEvent,
    });
    validation = validateWebhookWithProviderConfig({
      rawBody,
      headers,
      signatureFromHeader,
      providedSecret,
      providerConfig,
      webhookSecretValid,
      signatureValid,
      isWithdrawalTransferEvent,
    });
  } catch (error) {
    if (!isWithdrawalTransferEvent && error?.code === "provider_config_not_found") {
      validation = validateWebhookWithProviderConfig({
        rawBody,
        headers,
        signatureFromHeader,
        providedSecret,
        webhookSecretValid,
        signatureValid,
        isWithdrawalTransferEvent,
      });
    } else {
      throw error;
    }
  }

  const providerConfigFields = buildWebhookProviderConfigFields(providerConfig);
  const normalizedEventKeyBase =
    buildNormalizedWebhookEventKey(payload) ||
    createRequestHash(["abacatepay-webhook", rawBody || JSON.stringify(payload || {})]);
  const normalizedEventKey = providerConfigFields.provider_config_id
    ? `${providerConfigFields.provider_config_id}:${normalizedEventKeyBase}`
    : normalizedEventKeyBase;

  const { eventRow, duplicate } = await insertWebhookEvent(serviceClient, {
    provider: "abacatepay",
    event_type: eventType || null,
    provider_event_id: providerEventId,
    provider_checkout_id: providerCheckoutId,
    ...providerConfigFields,
    payment_gateway_checkout_id: checkoutRow?.id || null,
    payment_id: paymentIdToUse,
    tenant_id: tenantIdToUse,
    organization_id: organizationIdToUse,
    processing_status: "received",
    payload,
    raw_payload: rawBody,
    query_params: queryParams || {},
    headers: headers || {},
    webhook_secret_valid: !!validation?.webhookSecretValid,
    signature_valid: !!validation?.signatureValid,
    signature_algorithm: "HMAC-SHA256",
    api_version: inferAbacatepayApiVersion(payload),
    normalized_event_key: normalizedEventKey,
    processed_result: {},
    received_at: nowIso(),
  });

  if (duplicate) {
    return {
      ok: true,
      duplicate: true,
      eventId: eventRow?.id || null,
      validation,
    };
  }

  if (!validation?.allowed) {
    await upsertProcessedWebhook(serviceClient, eventRow.id, {
      processing_status: "failed",
      error_message: "invalid_webhook_auth",
      processed_result: {
        webhookSecretValid: !!validation?.webhookSecretValid,
        signatureValid: !!validation?.signatureValid,
        providerConfigId: providerConfigFields.provider_config_id,
      },
    });
    return { ok: false, status: 401, eventId: eventRow.id, validation };
  }

  const resource = extractAbacatepayResource(payload);
  if (checkoutRow) {
    await updateCheckoutRecord(serviceClient, checkoutRow.id, {
      provider_status: resource?.status || checkoutRow.provider_status,
      status: SUCCESS_EVENT_TYPES.has(eventType)
        ? "paid"
        : eventType.endsWith(".refunded")
          ? "refunded"
          : checkoutRow.status,
      response_payload: {
        ...(checkoutRow.response_payload || {}),
        webhook: resource || {},
      },
      paid_at: SUCCESS_EVENT_TYPES.has(eventType)
        ? extractResourceUpdatedAt(payload) || nowIso()
        : checkoutRow.paid_at,
      metadata: {
        ...(checkoutRow.metadata || {}),
        receiptUrl: extractReceiptUrl(payload) || checkoutRow.metadata?.receiptUrl || null,
      },
    });
  }

  let processedResult = {
    eventType,
    paymentId: paymentIdToUse,
    externalId,
    providerConfigId: providerConfigFields.provider_config_id,
    providerAccountId: providerConfigFields.provider_account_id,
    providerEnvironment: providerConfigFields.provider_environment,
    duplicate: false,
  };

  try {
    if (SUCCESS_EVENT_TYPES.has(eventType)) {
      if (!paymentIdToUse || !tenantIdToUse) {
        processedResult = { ...processedResult, ignored: "missing_payment_context" };
      } else {
        const paymentContext = await resolvePaymentOwnerContext(
          serviceClient,
          paymentIdToUse,
          tenantIdToUse
        );
        const creditResult = await applySuccessfulWalletCredit({
          serviceClient,
          eventRow,
          paymentContext,
          checkoutRow,
          payload,
        });
        processedResult = { ...processedResult, creditResult };
      }
    } else if (REVERSAL_EVENT_TYPES.has(eventType)) {
      if (!paymentIdToUse) {
        processedResult = { ...processedResult, ignored: "missing_payment_context" };
      } else {
        const reversalResult = await applyReversalOrHold({
          serviceClient,
          eventRow,
          paymentId: paymentIdToUse,
          checkoutRow,
          payload,
          eventType,
        });
        processedResult = { ...processedResult, reversalResult };
      }
    } else if (isWithdrawalTransferEvent) {
      const withdrawalResult = await processOwnerWithdrawalProviderWebhook({
        payload,
        eventType,
        eventRow,
      });
      processedResult = { ...processedResult, withdrawalResult };
    } else {
      processedResult = {
        ...processedResult,
        ignored: "unsupported_event",
      };
    }

    await upsertProcessedWebhook(serviceClient, eventRow.id, {
      processing_status: "processed",
      error_message: null,
      processed_result: processedResult,
    });

    return { ok: true, eventId: eventRow.id, processedResult, validation };
  } catch (error) {
    await upsertProcessedWebhook(serviceClient, eventRow.id, {
      processing_status: "failed",
      error_message: error.message || "webhook_processing_failed",
      processed_result: {
        ...processedResult,
        failed: true,
      },
    });
    throw error;
  }
}
