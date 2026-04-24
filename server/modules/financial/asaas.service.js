import { safeCompareStrings } from "./owner-wallet.utils.js";

const ASAAS_API_ORIGIN = "https://api.asaas.com";
const ASAAS_SANDBOX_API_ORIGIN = "https://api-sandbox.asaas.com";
const DEFAULT_TIMEOUT_MS = 15000;
const RESPONSE_API_VERSION_SYMBOL = Symbol.for("asaas.apiVersion");

function normalizeEnvironment(value) {
  return String(value || "production")
    .trim()
    .toLowerCase();
}

function resolveAsaasApiOrigin(providerConfig = {}) {
  const metadataOrigin = String(providerConfig?.metadata?.apiOrigin || "").trim();
  if (metadataOrigin) return metadataOrigin.replace(/\/+$/, "");

  const environment = normalizeEnvironment(providerConfig?.environment);
  if (environment === "sandbox" || environment === "test" || environment === "development") {
    return ASAAS_SANDBOX_API_ORIGIN;
  }

  return ASAAS_API_ORIGIN;
}

function resolveProviderConfigApiKey({ providerConfig = null, apiKey = null } = {}) {
  const explicitApiKey = String(apiKey || providerConfig?.apiKey || "").trim();
  if (explicitApiKey) return explicitApiKey;

  throw Object.assign(new Error("Configuracao ASAAS nao vinculada a operacao."), {
    status: 500,
    code: "provider_config_required",
  });
}

function buildRequestSignal(timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (typeof AbortSignal?.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  return undefined;
}

function annotateAsaasResponse(data) {
  if (data && typeof data === "object") {
    Object.defineProperty(data, RESPONSE_API_VERSION_SYMBOL, {
      value: 3,
      enumerable: false,
      configurable: true,
    });
  }
  return data;
}

export function getAsaasResponseApiVersion(payload) {
  const parsed = Number(payload?.[RESPONSE_API_VERSION_SYMBOL]);
  return parsed === 3 ? 3 : null;
}

function extractAsaasErrorMessage(data = {}, fallback = "Falha na integracao com o ASAAS.") {
  const firstError = Array.isArray(data?.errors) ? data.errors[0] : null;
  return (
    firstError?.description ||
    firstError?.message ||
    data?.message ||
    data?.error ||
    fallback
  );
}

async function asaasRequest({
  pathname,
  method = "GET",
  payload,
  searchParams = null,
  apiKey = null,
  providerConfig = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const url = new URL(`/v3${pathname}`, resolveAsaasApiOrigin(providerConfig));
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  try {
    const resolvedApiKey = resolveProviderConfigApiKey({
      providerConfig,
      apiKey,
    });

    const response = await fetch(url, {
      method,
      headers: {
        access_token: resolvedApiKey,
        "Content-Type": "application/json",
        "User-Agent": "kitnets-saas-admin",
      },
      body: payload == null ? undefined : JSON.stringify(payload),
      cache: "no-store",
      signal: buildRequestSignal(timeoutMs),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw Object.assign(new Error(String(extractAsaasErrorMessage(data, response.statusText))), {
        status: response.status || 502,
        providerData: data,
        isTransient:
          response.status === 408 ||
          response.status === 429 ||
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504,
      });
    }

    return annotateAsaasResponse(data);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw Object.assign(new Error("Tempo limite excedido ao consultar o ASAAS."), {
        status: 504,
        isTransient: true,
      });
    }

    if (typeof error?.status !== "number") {
      throw Object.assign(new Error(error?.message || "Falha de rede ao consultar o ASAAS."), {
        status: 502,
        isTransient: true,
      });
    }

    throw error;
  }
}

function amountToCents(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100));
}

function centsToAsaasValue(cents) {
  const parsed = Number(cents);
  if (!Number.isFinite(parsed)) return 0;
  return Number((Math.max(0, Math.round(parsed)) / 100).toFixed(2));
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeAsaasDueDate(value) {
  const today = todayDateString();
  const normalized = String(value || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return today;
  return normalized < today ? today : normalized;
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeCustomerPayload(customer = {}) {
  const name = String(customer?.name || "Inquilino").trim().slice(0, 255) || "Inquilino";
  const cpfCnpj = onlyDigits(customer?.cpfCnpj || customer?.taxId || customer?.documentNumber);
  if (![11, 14].includes(cpfCnpj.length)) {
    throw Object.assign(
      new Error("Para criar cobranca ASAAS, informe CPF ou CNPJ valido do inquilino."),
      { status: 400, code: "asaas_customer_tax_id_required" }
    );
  }

  const address = String(customer?.address || customer?.street || "").trim();
  const addressNumber = String(
    customer?.addressNumber ?? customer?.number ?? customer?.streetNumber ?? ""
  )
    .trim()
    .slice(0, 20);
  const province = String(
    customer?.province ?? customer?.neighborhood ?? customer?.district ?? ""
  )
    .trim()
    .slice(0, 255);
  const postalCode = onlyDigits(customer?.postalCode || customer?.zipCode || customer?.zipcode);

  const missingAddressFields = [];
  if (!address) missingAddressFields.push("logradouro");
  if (!addressNumber) missingAddressFields.push("numero");
  if (!province) missingAddressFields.push("bairro");
  if (postalCode.length !== 8) missingAddressFields.push("CEP");

  if (missingAddressFields.length > 0) {
    throw Object.assign(
      new Error(
        `Para criar cobranca ASAAS, informe no cadastro do inquilino: ${missingAddressFields.join(", ")}.`
      ),
      { status: 400, code: "asaas_customer_address_required" }
    );
  }

  const payload = {
    name,
    cpfCnpj,
    notificationDisabled: true,
    address,
    addressNumber,
    province,
    postalCode,
  };

  const email = String(customer?.email || "").trim();
  if (email) payload.email = email;

  const mobilePhone = onlyDigits(customer?.cellphone || customer?.mobilePhone || customer?.phone);
  if (mobilePhone) payload.mobilePhone = mobilePhone;

  const externalReference = String(customer?.externalReference || "").trim();
  if (externalReference) payload.externalReference = externalReference.slice(0, 255);

  return payload;
}

export async function createAsaasCustomer(customer = {}, { providerConfig = null } = {}) {
  return asaasRequest({
    pathname: "/customers",
    method: "POST",
    providerConfig,
    payload: normalizeCustomerPayload(customer),
  });
}

export async function createAsaasPixCharge({
  amountCents,
  description,
  customer = {},
  metadata = {},
  dueDate = null,
  providerConfig = null,
} = {}) {
  const customerResponse = await createAsaasCustomer(
    {
      ...customer,
      externalReference: customer?.externalReference || metadata?.tenantId || metadata?.paymentId,
    },
    { providerConfig }
  );

  const paymentResponse = await asaasRequest({
    pathname: "/payments",
    method: "POST",
    providerConfig,
    payload: {
      customer: customerResponse.id,
      billingType: "PIX",
      value: centsToAsaasValue(amountCents),
      dueDate: normalizeAsaasDueDate(dueDate),
      description: String(description || "Pagamento de aluguel").slice(0, 500),
      externalReference: String(metadata?.paymentId || metadata?.externalReference || "").slice(
        0,
        255
      ),
    },
  });

  const pixQrCode = await asaasRequest({
    pathname: `/payments/${encodeURIComponent(paymentResponse.id)}/pixQrCode`,
    method: "GET",
    providerConfig,
  });

  return annotateAsaasResponse({
    provider: "asaas",
    data: {
      ...paymentResponse,
      customerRecord: customerResponse,
      pixQrCode,
      metadata,
    },
  });
}

function normalizeBase64Image(value) {
  const encodedImage = String(value || "").trim();
  if (!encodedImage) return null;
  if (/^data:image\//i.test(encodedImage)) return encodedImage;
  return `data:image/png;base64,${encodedImage}`;
}

export function sanitizeAsaasCheckoutPayload(payload = {}) {
  const data = payload?.data || payload;
  const payment = data?.payment || data;
  const pixQrCode = data?.pixQrCode || payment?.pixQrCode || {};
  const amountCents = amountToCents(payment?.value ?? payment?.originalValue ?? data?.value);
  const netValueCents = amountToCents(payment?.netValue);
  const explicitFeeCents = amountToCents(
    payment?.billingFee ?? payment?.fee ?? payment?.discount?.value ?? 0
  );
  const inferredFeeCents =
    amountCents > 0 && netValueCents > 0 ? Math.max(amountCents - netValueCents, 0) : 0;

  return {
    id: payment?.id || null,
    amount: amountCents,
    paidAmount:
      String(payment?.status || "").toUpperCase() === "RECEIVED" ? amountCents : null,
    status: payment?.status || null,
    platformFee: explicitFeeCents || inferredFeeCents,
    brCode: pixQrCode?.payload || null,
    brCodeBase64: normalizeBase64Image(pixQrCode?.encodedImage),
    receiptUrl: payment?.transactionReceiptUrl || payment?.invoiceUrl || null,
    expiresAt: pixQrCode?.expirationDate || null,
    createdAt: payment?.dateCreated || null,
    updatedAt:
      payment?.paymentDate ||
      payment?.clientPaymentDate ||
      payment?.confirmedDate ||
      payment?.updatedAt ||
      null,
    metadata: data?.metadata || payment?.metadata || {},
  };
}

export function normalizeAsaasPixKeyType(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (normalized === "CPF") return "CPF";
  if (normalized === "CNPJ") return "CNPJ";
  if (normalized === "EMAIL") return "EMAIL";
  if (normalized === "PHONE" || normalized === "TELEFONE") return "PHONE";
  return "EVP";
}

export function buildAsaasPixTransferPayload({
  amountCents,
  externalId,
  description,
  pixKey,
  pixKeyType,
} = {}) {
  const normalizedPixKeyType = normalizeAsaasPixKeyType(pixKeyType);
  const normalizedPixKey =
    normalizedPixKeyType === "EMAIL" || normalizedPixKeyType === "EVP"
      ? String(pixKey || "").trim()
      : onlyDigits(pixKey);

  return {
    value: centsToAsaasValue(amountCents),
    operationType: "PIX",
    pixAddressKey: normalizedPixKey,
    pixAddressKeyType: normalizedPixKeyType,
    scheduleDate: null,
    description: String(description || "Repasse SaaS").slice(0, 255),
    externalReference: String(externalId || "").trim(),
  };
}

export async function sendAsaasPixTransfer(payload = {}, { providerConfig = null } = {}) {
  return asaasRequest({
    pathname: "/transfers",
    method: "POST",
    providerConfig,
    payload,
  });
}

export async function getAsaasPixTransferByExternalId(
  externalId,
  { providerConfig = null, providerReferenceId = null } = {}
) {
  const primaryId = String(providerReferenceId || externalId || "").trim();
  if (!primaryId) {
    throw Object.assign(new Error("Informe a transferencia ASAAS para consulta."), {
      status: 400,
    });
  }

  try {
    return await asaasRequest({
      pathname: `/transfers/${encodeURIComponent(primaryId)}`,
      method: "GET",
      providerConfig,
    });
  } catch (error) {
    const fallbackId = String(externalId || "").trim();
    if (error?.status !== 404 || !providerReferenceId || !fallbackId || fallbackId === primaryId) {
      throw error;
    }

    return asaasRequest({
      pathname: `/transfers/${encodeURIComponent(fallbackId)}`,
      method: "GET",
      providerConfig,
    });
  }
}

export function extractAsaasPaymentResource(payload = {}) {
  return payload?.payment || payload?.data?.payment || payload?.data || payload || null;
}

export function extractAsaasTransferResource(payload = {}) {
  return payload?.transfer || payload?.data?.transfer || payload?.data || payload || null;
}

export function sanitizeAsaasPixTransferResponse(payload = {}) {
  const data = extractAsaasTransferResource(payload);

  return {
    id: data?.id || null,
    status: data?.status || null,
    method: data?.operationType || "PIX",
    kind: data?.type || null,
    devMode: null,
    receiptUrl: data?.transactionReceiptUrl || null,
    amount: data?.value == null ? null : amountToCents(data.value),
    platformFee: data?.transferFee == null ? null : amountToCents(data.transferFee),
    externalId: data?.externalReference || null,
    createdAt: data?.dateCreated || null,
    updatedAt: data?.effectiveDate || data?.confirmedDate || data?.dateCreated || null,
    endToEndIdentifier: data?.endToEndIdentifier || null,
  };
}

export function mapAsaasTransferStatusToWithdrawalResolution(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (!normalized || normalized === "PENDING" || normalized === "IN_BANK_PROCESSING") return null;
  if (normalized === "DONE" || normalized === "COMPLETED") return "succeeded";
  if (normalized === "CANCELLED" || normalized === "CANCELED") return "cancelled";
  if (normalized === "FAILED") return "failed";
  return null;
}

export function normalizeAsaasEventType(payload = {}) {
  return String(payload?.event || payload?.type || "")
    .trim()
    .toUpperCase();
}

export function normalizeAsaasInternalEventType(payload = {}) {
  const eventType = normalizeAsaasEventType(payload);
  if (eventType === "PAYMENT_RECEIVED") return "payment.received";
  if (eventType === "PAYMENT_CONFIRMED") return "payment.confirmed";
  if (eventType === "PAYMENT_REFUNDED" || eventType === "PAYMENT_PARTIALLY_REFUNDED") {
    return "payment.refunded";
  }
  if (eventType === "TRANSFER_DONE") return "transfer.done";
  if (eventType === "TRANSFER_FAILED") return "transfer.failed";
  if (eventType === "TRANSFER_CANCELLED" || eventType === "TRANSFER_CANCELED") {
    return "transfer.cancelled";
  }
  if (eventType === "TRANSFER_CREATED") return "transfer.created";
  if (eventType === "TRANSFER_PENDING") return "transfer.pending";
  return eventType.toLowerCase();
}

export function extractAsaasPaymentId(payload = {}) {
  const payment = extractAsaasPaymentResource(payload);
  return payment?.id == null || String(payment.id).trim() === "" ? null : String(payment.id).trim();
}

export function extractAsaasExternalReference(payload = {}) {
  const payment = extractAsaasPaymentResource(payload);
  const transfer = extractAsaasTransferResource(payload);
  const externalReference =
    payment?.externalReference ||
    transfer?.externalReference ||
    payload?.externalReference ||
    payload?.data?.externalReference ||
    null;

  if (externalReference == null || String(externalReference).trim() === "") return null;
  return String(externalReference).trim();
}

export function buildAsaasNormalizedWebhookEventKey(payload = {}) {
  const eventType = normalizeAsaasInternalEventType(payload);
  const eventId =
    payload?.id != null && String(payload.id).trim() ? String(payload.id).trim() : null;
  const paymentId = extractAsaasPaymentId(payload);
  const transferId = extractAsaasTransferResource(payload)?.id || null;
  const resourceId = paymentId || transferId;

  if (eventType && eventId) return `${eventType}:${eventId}`;
  if (eventType && resourceId) return `${eventType}:${resourceId}`;
  return eventId || resourceId || null;
}

export function buildAsaasWalletPaymentPayload(payload = {}) {
  const payment = extractAsaasPaymentResource(payload);
  const valueCents = amountToCents(payment?.value ?? payment?.originalValue ?? 0);
  const netValueCents = amountToCents(payment?.netValue);
  const feeCents =
    valueCents > 0 && netValueCents > 0 ? Math.max(valueCents - netValueCents, 0) : 0;

  return {
    data: {
      id: payment?.id || null,
      status: payment?.status || null,
      amount: valueCents,
      paidAmount: valueCents,
      platformFee: feeCents,
      externalId: payment?.externalReference || null,
      receiptUrl: payment?.transactionReceiptUrl || payment?.invoiceUrl || null,
      updatedAt:
        payment?.paymentDate ||
        payment?.clientPaymentDate ||
        payment?.confirmedDate ||
        payment?.dateCreated ||
        null,
      metadata: {
        paymentId: payment?.externalReference || null,
      },
    },
  };
}

function normalizeHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers || {}).map(([key, value]) => [String(key || "").toLowerCase(), value])
  );
}

export function validateAsaasWebhookRequest({
  headers = {},
  providedToken = "",
  expectedToken = "",
} = {}) {
  const normalizedHeaders = normalizeHeaders(headers);
  const headerToken = String(providedToken || normalizedHeaders["asaas-access-token"] || "").trim();
  const configuredToken = String(expectedToken || "").trim();
  const tokenConfigured = !!configuredToken;
  const tokenProvided = !!headerToken;
  const tokenValid = tokenConfigured && tokenProvided && safeCompareStrings(headerToken, configuredToken);

  return {
    tokenConfigured,
    tokenProvided,
    tokenValid,
    allowed: tokenValid,
  };
}

function sanitizeQueryForAudit(query = {}) {
  const safeQuery = {};
  for (const [key, value] of Object.entries(query || {})) {
    const normalizedKey = String(key || "").toLowerCase();
    const isSensitive =
      normalizedKey.includes("secret") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("api-key") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("authorization");
    safeQuery[key] = isSensitive ? "[redacted]" : value;
  }
  return safeQuery;
}

export function sanitizeAsaasWebhookAuditInput({ headers = {}, query = {} } = {}) {
  const allowedHeaderNames = new Set([
    "content-type",
    "user-agent",
    "asaas-access-token",
    "x-provider-config-id",
    "x-asaas-provider-config-id",
    "x-forwarded-for",
    "x-forwarded-proto",
  ]);
  const safeHeaders = {};

  for (const [key, value] of Object.entries(headers || {})) {
    const normalizedKey = String(key || "").toLowerCase();
    if (!allowedHeaderNames.has(normalizedKey)) continue;
    safeHeaders[normalizedKey] = normalizedKey.includes("token") ? "[redacted]" : value;
  }

  return {
    headers: safeHeaders,
    query: sanitizeQueryForAudit(query),
  };
}

function normalizeOrigin(origin) {
  const normalized = String(origin || "").trim().replace(/\/+$/, "");
  return normalized || null;
}

export function getAsaasWebhookConfigStatus({ origin = "" } = {}) {
  const normalizedOrigin = normalizeOrigin(origin);
  const endpointPath = "/api/webhooks/asaas";
  const recommendedUrl = normalizedOrigin
    ? `${normalizedOrigin}${endpointPath}?providerConfigId=<provider_config_id>`
    : null;

  return {
    ready: !!normalizedOrigin,
    origin: normalizedOrigin,
    endpointPath,
    recommendedUrl,
    tokenHeader: "asaas-access-token",
    missing: normalizedOrigin ? [] : ["PUBLIC_WEBHOOK_ORIGIN"],
    recommendedWithdrawalEvents: ["TRANSFER_DONE", "TRANSFER_FAILED", "TRANSFER_CANCELLED"],
    recommendedPaymentEvents: ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_REFUNDED"],
    supportedEvents: [
      "PAYMENT_RECEIVED",
      "PAYMENT_CONFIRMED",
      "PAYMENT_REFUNDED",
      "PAYMENT_PARTIALLY_REFUNDED",
      "TRANSFER_DONE",
      "TRANSFER_FAILED",
      "TRANSFER_CANCELLED",
      "TRANSFER_CREATED",
      "TRANSFER_PENDING",
    ],
  };
}
