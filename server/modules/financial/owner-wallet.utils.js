import crypto from "node:crypto";

export const OWNER_WALLET_HOLD_SECONDS = 20;
export const MIN_WITHDRAWAL_CENTS = 350;

export function getAbacatePayWebhookPublicKey() {
  return String(process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY || "").trim();
}

function normalizeMoneyString(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
}

export function parseCurrencyInputToCents(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  const normalized = normalizeMoneyString(value);
  if (!normalized) return 0;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function centsToAmount(cents) {
  const parsed = Number(cents);
  if (!Number.isFinite(parsed)) return 0;
  return parsed / 100;
}

export function computeFundsAvailableAt(paidAt, holdSeconds = OWNER_WALLET_HOLD_SECONDS) {
  const baseDate = paidAt ? new Date(paidAt) : new Date();
  if (Number.isNaN(baseDate.getTime())) return null;
  const nextDate = new Date(baseDate.getTime());
  nextDate.setUTCSeconds(nextDate.getUTCSeconds() + Number(holdSeconds || 0));
  return nextDate.toISOString();
}

export function resolveEffectiveAvailableAt({
  entryType,
  paidAt,
  availableAt,
  createdAt,
} = {}) {
  const fallback = availableAt || createdAt || null;
  if (entryType !== "payment_credit") return fallback;

  const computedAvailableAt = computeFundsAvailableAt(paidAt || createdAt);
  if (!computedAvailableAt) return fallback;
  if (!availableAt) return computedAvailableAt;

  const storedDate = new Date(availableAt);
  const computedDate = new Date(computedAvailableAt);
  if (Number.isNaN(storedDate.getTime()) || Number.isNaN(computedDate.getTime())) {
    return fallback;
  }

  return storedDate <= computedDate ? storedDate.toISOString() : computedDate.toISOString();
}

export function normalizePixKeyType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "cpf") return "CPF";
  if (normalized === "cnpj") return "CNPJ";
  if (normalized === "email") return "EMAIL";
  if (normalized === "phone" || normalized === "telefone") return "PHONE";
  if (normalized === "br_code" || normalized === "brcode" || normalized === "qr") return "BR_CODE";
  return "RANDOM";
}

export function normalizePixKeyValue(value, type = "RANDOM") {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const normalizedType = normalizePixKeyType(type);
  if (normalizedType === "EMAIL") return raw.toLowerCase();
  if (normalizedType === "CPF" || normalizedType === "CNPJ" || normalizedType === "PHONE") {
    return raw.replace(/\D/g, "");
  }

  return raw;
}

export function validatePixKeyValue(value, type = "RANDOM") {
  const normalizedType = normalizePixKeyType(type);
  const normalizedValue = normalizePixKeyValue(value, normalizedType);

  if (!normalizedValue) {
    return {
      valid: false,
      normalizedValue,
      normalizedType,
      reason: "pix_key_missing",
    };
  }

  if (normalizedType === "CPF") {
    return {
      valid: normalizedValue.length === 11,
      normalizedValue,
      normalizedType,
      reason: normalizedValue.length === 11 ? null : "pix_key_invalid_cpf",
    };
  }

  if (normalizedType === "CNPJ") {
    return {
      valid: normalizedValue.length === 14,
      normalizedValue,
      normalizedType,
      reason: normalizedValue.length === 14 ? null : "pix_key_invalid_cnpj",
    };
  }

  if (normalizedType === "PHONE") {
    return {
      valid: normalizedValue.length >= 10 && normalizedValue.length <= 13,
      normalizedValue,
      normalizedType,
      reason:
        normalizedValue.length >= 10 && normalizedValue.length <= 13
          ? null
          : "pix_key_invalid_phone",
    };
  }

  if (normalizedType === "EMAIL") {
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue);
    return {
      valid: emailValid,
      normalizedValue,
      normalizedType,
      reason: emailValid ? null : "pix_key_invalid_email",
    };
  }

  return {
    valid: normalizedValue.length >= 20 && normalizedValue.length <= 77,
    normalizedValue,
    normalizedType,
    reason:
      normalizedValue.length >= 20 && normalizedValue.length <= 77
        ? null
        : "pix_key_invalid_random",
  };
}

export function maskPixKey(value, type = "RANDOM") {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const normalizedType = normalizePixKeyType(type);

  if (normalizedType === "EMAIL") {
    const [name = "", domain = ""] = raw.split("@");
    const safeName =
      name.length <= 2 ? `${name[0] || "*"}*` : `${name.slice(0, 2)}***${name.slice(-1)}`;
    return domain ? `${safeName}@${domain}` : safeName;
  }

  const digits = raw.replace(/\D/g, "");
  if (normalizedType === "CPF" || normalizedType === "CNPJ" || normalizedType === "PHONE") {
    if (digits.length <= 4) return `${digits.slice(0, 1)}***`;
    return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
  }

  if (raw.length <= 6) return `${raw.slice(0, 2)}***`;
  return `${raw.slice(0, 4)}***${raw.slice(-4)}`;
}

export function normalizeTaxId(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  return digits;
}

export function maskTaxId(value) {
  const normalized = normalizeTaxId(value);
  if (!normalized) return null;

  if (normalized.length <= 4) return `${normalized.slice(0, 1)}***`;
  if (normalized.length <= 11) return maskPixKey(normalized, "CPF");
  return maskPixKey(normalized, "CNPJ");
}

export function buildAbacatePixTransferPayload({
  amountCents,
  externalId,
  description,
  pixKey,
  pixKeyType,
} = {}) {
  const pixKeyValidation = validatePixKeyValue(pixKey, pixKeyType);
  const normalizedPixKey = pixKeyValidation.normalizedValue;
  const normalizedPixKeyType = pixKeyValidation.normalizedType;
  const normalizedExternalId = String(externalId || "").trim();
  const normalizedDescription = String(description || "").trim() || "Repasse SaaS";

  const payload = {
    amount: Math.max(0, Math.round(Number(amountCents) || 0)),
    externalId: normalizedExternalId,
    method: "PIX",
    description: normalizedDescription,
    pix: {
      key: normalizedPixKey,
      type: normalizedPixKeyType,
    },
  };

  return payload;
}

export function sanitizeAbacatepixTransferPayload(payload = {}) {
  const data = extractAbacatepayResource(payload) || payload?.data || payload;

  return {
    id: data?.id || null,
    status: data?.status || null,
    method: data?.method || null,
    kind: data?.kind || null,
    devMode: typeof data?.devMode === "boolean" ? data.devMode : null,
    receiptUrl: data?.receiptUrl || null,
    amount: data?.amount ?? null,
    platformFee: data?.platformFee ?? null,
    externalId: data?.externalId || null,
    createdAt: data?.createdAt || null,
    updatedAt: data?.updatedAt || null,
    endToEndIdentifier: data?.endToEndIdentifier || null,
  };
}

export function mapAbacatepixTransferStatusToWithdrawalResolution(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (!normalized || normalized === "PENDING") return null;
  if (normalized === "COMPLETE" || normalized === "COMPLETED") return "succeeded";
  if (normalized === "CANCELLED") return "cancelled";
  if (normalized === "FAILED" || normalized === "EXPIRED" || normalized === "REFUNDED") {
    return "failed";
  }
  return null;
}

export function createRequestHash(parts = []) {
  return crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function safeCompareStrings(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function verifyAbacatepaySignature(rawBody, signatureFromHeader, publicKey = getAbacatePayWebhookPublicKey()) {
  if (!rawBody || !signatureFromHeader) return false;
  const normalizedSignature = String(signatureFromHeader).trim();
  if (!normalizedSignature) return false;
  if (!publicKey) return false;

  const expectedSignature = crypto
    .createHmac("sha256", publicKey)
    .update(Buffer.from(rawBody, "utf8"))
    .digest("base64");

  return safeCompareStrings(expectedSignature, normalizedSignature);
}

export function normalizeAbacatepayEventType(payload) {
  const normalized = String(payload?.event || payload?.type || "")
    .trim()
    .toLowerCase();

  if (normalized === "billing.paid") return "billing.paid";
  if (normalized === "billing.refunded") return "billing.refunded";
  if (normalized === "withdraw.completed") return "withdraw.completed";
  if (normalized === "withdraw.done") return "withdraw.done";
  if (normalized === "withdraw.failed") return "withdraw.failed";

  return normalized;
}

export function inferAbacatepayApiVersion(payload) {
  const explicitVersion = Number(payload?.apiVersion);
  if (explicitVersion === 1 || explicitVersion === 2) return explicitVersion;

  const eventType = normalizeAbacatepayEventType(payload);
  if (
    eventType.startsWith("billing.") ||
    eventType.startsWith("withdraw.") ||
    payload?.api_version === 1
  ) {
    return 1;
  }

  if (
    eventType.startsWith("checkout.") ||
    eventType.startsWith("transparent.") ||
    eventType.startsWith("payout.") ||
    eventType.startsWith("reconciliation.")
  ) {
    return 2;
  }

  return null;
}

function isResourceLike(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value.id != null ||
      value.amount != null ||
      value.status != null ||
      value.paymentId != null ||
      value.metadata != null)
  );
}

export function extractAbacatepayResource(payload) {
  const data = payload?.data || {};
  if (isResourceLike(data)) {
    return data;
  }

  return (
    data.transparent ||
    data.checkout ||
    data.payout ||
    data.transfer ||
    data.withdraw ||
    (isResourceLike(payload) ? payload : null) ||
    null
  );
}

export function extractAbacatepayEventId(payload) {
  const rootId = payload?.id;
  if (rootId != null && String(rootId).trim()) return String(rootId).trim();
  const resource = extractAbacatepayResource(payload);
  if (resource?.id != null && String(resource.id).trim()) return String(resource.id).trim();
  return null;
}

export function extractAbacatepayExternalId(payload) {
  const resource = extractAbacatepayResource(payload);
  const externalId =
    resource?.externalId ??
    resource?.metadata?.externalId ??
    resource?.metadata?.withdrawalRequestId ??
    resource?.metadata?.withdrawal_request_id ??
    payload?.data?.metadata?.externalId ??
    payload?.data?.metadata?.withdrawalRequestId ??
    payload?.data?.metadata?.withdrawal_request_id ??
    resource?.metadata?.paymentId ??
    resource?.metadata?.payment_id ??
    null;
  if (externalId == null || String(externalId).trim() === "") return null;
  return String(externalId).trim();
}

export function extractAbacatepayPaymentMetadata(payload) {
  const resource = extractAbacatepayResource(payload);
  return resource?.metadata || payload?.data?.metadata || payload?.metadata || {};
}

export function extractAbacatepayPaymentId(payload) {
  const metadata = extractAbacatepayPaymentMetadata(payload);
  const paymentId =
    payload?.paymentId ??
    payload?.data?.paymentId ??
    payload?.data?.metadata?.paymentId ??
    metadata?.paymentId ??
    metadata?.payment_id ??
    metadata?.pagamentoId ??
    extractAbacatepayExternalId(payload);

  if (paymentId == null || String(paymentId).trim() === "") return null;
  return String(paymentId).trim();
}

export function extractAbacatepayResourceId(payload) {
  const resource = extractAbacatepayResource(payload);
  if (resource?.id == null || String(resource.id).trim() === "") return null;
  return String(resource.id).trim();
}

export function buildNormalizedWebhookEventKey(payload) {
  const eventType = normalizeAbacatepayEventType(payload);
  const eventId =
    payload?.id != null && String(payload.id).trim() ? String(payload.id).trim() : null;
  if (eventType && eventId) return `${eventType}:${eventId}`;

  const resourceId = extractAbacatepayResourceId(payload);
  const externalId = extractAbacatepayExternalId(payload);
  if (eventType && resourceId && externalId) return `${eventType}:${resourceId}:${externalId}`;
  if (eventType && resourceId) return `${eventType}:${resourceId}`;
  return eventId || resourceId || null;
}

export function extractPaidAmountCents(payload) {
  const resource = extractAbacatepayResource(payload);
  const candidate = resource?.paidAmount ?? resource?.amount ?? payload?.amount ?? payload?.data?.amount ?? null;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

export function extractPlatformFeeCents(payload) {
  const resource = extractAbacatepayResource(payload);
  const parsed = Number(
    resource?.platformFee ??
    resource?.gatewayFee ??
    resource?.fee ??
    payload?.platformFee ??
    payload?.data?.platformFee ??
    0
  );
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

export function extractReceiptUrl(payload) {
  const resource = extractAbacatepayResource(payload);
  return resource?.receiptUrl || null;
}

export function extractResourceUpdatedAt(payload) {
  const resource = extractAbacatepayResource(payload);
  return (
    resource?.updatedAt ||
    resource?.createdAt ||
    payload?.paymentDate ||
    payload?.data?.paymentDate ||
    null
  );
}

export function sanitizeHeadersForAudit(headersLike) {
  const safeHeaders = {};
  const allowedHeaderNames = new Set([
    "content-type",
    "user-agent",
    "x-abacate-signature",
    "x-webhook-signature",
    "x-provider-config-id",
    "x-abacatepay-provider-config-id",
    "x-forwarded-for",
    "x-forwarded-proto",
  ]);

  for (const [key, value] of Object.entries(headersLike || {})) {
    const normalizedKey = String(key || "").toLowerCase();
    if (!allowedHeaderNames.has(normalizedKey)) continue;
    safeHeaders[normalizedKey] = value;
  }

  return safeHeaders;
}

export function extractWebhookSignatureFromHeaders(headersLike = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headersLike || {}).map(([key, value]) => [String(key || "").toLowerCase(), value])
  );

  const signature =
    normalizedHeaders["x-webhook-signature"] ||
    normalizedHeaders["x-abacate-signature"] ||
    null;

  return signature == null ? null : String(signature).trim();
}

export function mapWithdrawalStatusLabel(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "queued_manual_settlement") return "queued_manual_settlement";
  if (normalized === "processing") return "processing";
  if (normalized === "provider_pending") return "provider_pending";
  if (normalized === "succeeded") return "succeeded";
  if (normalized === "failed") return "failed";
  if (normalized === "cancelled") return "cancelled";
  if (normalized === "reserved") return "reserved";
  return "requested";
}
