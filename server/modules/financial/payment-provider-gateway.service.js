import {
  createTransparentPixCharge,
  getAbacatepayResponseApiVersion,
  getPixTransferByExternalId,
  sanitizeCheckoutPayload,
  sanitizePixTransferResponse,
  sendPixTransfer,
} from "@/server/modules/financial/abacatepay.service";
import {
  buildAbacatePixTransferPayload,
  extractAbacatepayExternalId,
  extractAbacatepayResourceId,
  mapAbacatepixTransferStatusToWithdrawalResolution,
  normalizeAbacatepayEventType,
} from "@/server/modules/financial/owner-wallet.utils";
import {
  buildAsaasPixTransferPayload,
  createAsaasPixCharge,
  extractAsaasExternalReference,
  extractAsaasTransferResource,
  getAsaasPixTransferByExternalId,
  getAsaasResponseApiVersion,
  mapAsaasTransferStatusToWithdrawalResolution,
  normalizeAsaasInternalEventType,
  sanitizeAsaasCheckoutPayload,
  sanitizeAsaasPixTransferResponse,
  sendAsaasPixTransfer,
} from "@/server/modules/financial/asaas.service";

export const PAYMENT_PROVIDER_ABACATEPAY = "abacatepay";
export const PAYMENT_PROVIDER_ASAAS = "asaas";
export const SUPPORTED_PAYMENT_PROVIDERS = [
  PAYMENT_PROVIDER_ABACATEPAY,
  PAYMENT_PROVIDER_ASAAS,
];

const PROVIDER_LABELS = {
  [PAYMENT_PROVIDER_ABACATEPAY]: "AbacatePay",
  [PAYMENT_PROVIDER_ASAAS]: "ASAAS",
};

export function normalizePaymentProvider(provider) {
  const normalized = String(provider || "")
    .trim()
    .toLowerCase();
  return normalized || PAYMENT_PROVIDER_ABACATEPAY;
}

export function getPaymentProviderLabel(provider) {
  return PROVIDER_LABELS[normalizePaymentProvider(provider)] || "Gateway";
}

export async function createProviderPixCharge({
  providerConfig,
  amountCents,
  description,
  expiresInSeconds,
  customer,
  metadata,
  dueDate = null,
} = {}) {
  const provider = normalizePaymentProvider(providerConfig?.provider);
  if (provider === PAYMENT_PROVIDER_ASAAS) {
    return createAsaasPixCharge({
      amountCents,
      description,
      customer,
      metadata,
      dueDate,
      providerConfig,
    });
  }

  return createTransparentPixCharge({
    amountCents,
    description,
    expiresInSeconds,
    customer,
    metadata,
    providerConfig,
  });
}

export function sanitizeProviderCheckoutPayload(provider, payload = {}) {
  if (normalizePaymentProvider(provider) === PAYMENT_PROVIDER_ASAAS) {
    return sanitizeAsaasCheckoutPayload(payload);
  }

  return sanitizeCheckoutPayload(payload);
}

export function getProviderResponseApiVersion(provider, payload = {}) {
  if (normalizePaymentProvider(provider) === PAYMENT_PROVIDER_ASAAS) {
    return getAsaasResponseApiVersion(payload) || 3;
  }

  return getAbacatepayResponseApiVersion(payload) || 2;
}

export function buildProviderPixTransferPayload(provider, payload = {}) {
  if (normalizePaymentProvider(provider) === PAYMENT_PROVIDER_ASAAS) {
    return buildAsaasPixTransferPayload(payload);
  }

  return buildAbacatePixTransferPayload(payload);
}

export async function sendProviderPixTransfer(payload = {}, { providerConfig = null } = {}) {
  const provider = normalizePaymentProvider(providerConfig?.provider);
  if (provider === PAYMENT_PROVIDER_ASAAS) {
    return sendAsaasPixTransfer(payload, { providerConfig });
  }

  return sendPixTransfer(payload, { providerConfig });
}

export async function getProviderPixTransferByExternalId(
  externalId,
  { providerConfig = null, providerReferenceId = null } = {}
) {
  const provider = normalizePaymentProvider(providerConfig?.provider);
  if (provider === PAYMENT_PROVIDER_ASAAS) {
    return getAsaasPixTransferByExternalId(externalId, {
      providerConfig,
      providerReferenceId,
    });
  }

  return getPixTransferByExternalId(externalId, { providerConfig });
}

export function sanitizeProviderPixTransferResponse(provider, payload = {}) {
  if (normalizePaymentProvider(provider) === PAYMENT_PROVIDER_ASAAS) {
    return sanitizeAsaasPixTransferResponse(payload);
  }

  return sanitizePixTransferResponse(payload);
}

export function mapProviderPixTransferStatusToWithdrawalResolution(provider, status) {
  if (normalizePaymentProvider(provider) === PAYMENT_PROVIDER_ASAAS) {
    return mapAsaasTransferStatusToWithdrawalResolution(status);
  }

  return mapAbacatepixTransferStatusToWithdrawalResolution(status);
}

export function normalizeProviderWithdrawalEventType(provider, payload = {}, eventType = null) {
  if (eventType) return String(eventType).trim().toLowerCase();

  if (normalizePaymentProvider(provider) === PAYMENT_PROVIDER_ASAAS) {
    return normalizeAsaasInternalEventType(payload);
  }

  return normalizeAbacatepayEventType(payload);
}

export function isProviderWithdrawalEvent(provider, eventType) {
  const normalized = String(eventType || "").trim().toLowerCase();
  if (normalizePaymentProvider(provider) === PAYMENT_PROVIDER_ASAAS) {
    return (
      normalized === "transfer.done" ||
      normalized === "transfer.failed" ||
      normalized === "transfer.cancelled" ||
      normalized === "transfer.canceled"
    );
  }

  return (
    normalized === "transfer.completed" ||
    normalized === "transfer.failed" ||
    normalized === "payout.completed" ||
    normalized === "payout.done" ||
    normalized === "payout.failed" ||
    normalized === "withdraw.completed" ||
    normalized === "withdraw.done" ||
    normalized === "withdraw.failed"
  );
}

export function extractProviderTransferExternalId(provider, payload = {}) {
  if (normalizePaymentProvider(provider) === PAYMENT_PROVIDER_ASAAS) {
    return extractAsaasExternalReference(payload);
  }

  return extractAbacatepayExternalId(payload);
}

export function extractProviderTransferReferenceId(provider, payload = {}) {
  if (normalizePaymentProvider(provider) === PAYMENT_PROVIDER_ASAAS) {
    const transfer = extractAsaasTransferResource(payload);
    return transfer?.id == null || String(transfer.id).trim() === ""
      ? null
      : String(transfer.id).trim();
  }

  return extractAbacatepayResourceId(payload);
}
