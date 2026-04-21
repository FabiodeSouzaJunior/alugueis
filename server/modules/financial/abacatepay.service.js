import {
  extractWebhookSignatureFromHeaders,
  getAbacatePayWebhookPublicKey,
  sanitizeAbacatepixTransferPayload,
  sanitizeHeadersForAudit,
  safeCompareStrings,
  verifyAbacatepaySignature,
} from "./owner-wallet.utils.js";

const ABACATEPAY_API_ORIGIN = "https://api.abacatepay.com";
const DEFAULT_TIMEOUT_MS = 15000;
const SUPPORTED_API_VERSIONS = [2, 1];
const RESPONSE_API_VERSION_SYMBOL = Symbol.for("abacatepay.apiVersion");

export function getAbacatePayWebhookSecret() {
  return String(process.env.ABACATEPAY_WEBHOOK_SECRET || "").trim();
}

function resolveProviderConfigApiKey({ providerConfig = null, apiKey = null } = {}) {
  const explicitApiKey = String(apiKey || providerConfig?.apiKey || "").trim();
  if (explicitApiKey) return explicitApiKey;

  throw Object.assign(new Error("Configuracao AbacatePay nao vinculada a operacao."), {
    status: 500,
    code: "provider_config_required",
  });
}

function normalizeApiVersion(value) {
  const parsed = Number(String(value || "").trim().replace(/^v/i, ""));
  return SUPPORTED_API_VERSIONS.includes(parsed) ? parsed : null;
}

function resolvePreferredApiVersion(providerConfig = null) {
  return (
    normalizeApiVersion(providerConfig?.metadata?.apiVersion) ||
    normalizeApiVersion(providerConfig?.metadata?.preferredApiVersion) ||
    normalizeApiVersion(providerConfig?.metadata?.webhookVersion) ||
    2
  );
}

function buildApiVersionOrder(providerConfig = null) {
  const preferred = resolvePreferredApiVersion(providerConfig);
  return [preferred, ...SUPPORTED_API_VERSIONS.filter((version) => version !== preferred)];
}

function annotateAbacatepayResponse(data, apiVersion) {
  if (data && typeof data === "object") {
    Object.defineProperty(data, RESPONSE_API_VERSION_SYMBOL, {
      value: apiVersion,
      enumerable: false,
      configurable: true,
    });
  }
  return data;
}

export function getAbacatepayResponseApiVersion(payload) {
  return normalizeApiVersion(payload?.[RESPONSE_API_VERSION_SYMBOL]) || null;
}

function isApiKeyVersionMismatch(error) {
  const message = String(error?.message || error?.providerData?.error || "").toLowerCase();
  return error?.status === 401 && message.includes("api key version mismatch");
}

function buildVersionMismatchError(lastError) {
  return Object.assign(
    new Error(
      "Chave da AbacatePay incompativel com as versoes v1 e v2 testadas. Verifique se a API key foi criada para a integracao correta e possui as permissoes necessarias."
    ),
    {
      status: lastError?.status || 401,
      providerData: lastError?.providerData || null,
      isTransient: false,
    }
  );
}

function buildRequestSignal(timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (typeof AbortSignal?.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  return undefined;
}

async function abacatePayRequest({
  pathname,
  method = "POST",
  payload,
  searchParams = null,
  apiVersion = 2,
  apiKey = null,
  providerConfig = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const url = new URL(`/v${apiVersion}${pathname}`, ABACATEPAY_API_ORIGIN);
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
        Authorization: `Bearer ${resolvedApiKey}`,
        "Content-Type": "application/json",
      },
      body: payload == null ? undefined : JSON.stringify(payload),
      cache: "no-store",
      signal: buildRequestSignal(timeoutMs),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success === false) {
      let errorMessage =
        data?.error || response.statusText || "Falha na integracao com a AbacatePay.";
      throw Object.assign(new Error(String(errorMessage)), {
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

    return annotateAbacatepayResponse(data, apiVersion);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw Object.assign(new Error("Tempo limite excedido ao consultar a AbacatePay."), {
        status: 504,
        isTransient: true,
      });
    }

    if (typeof error?.status !== "number") {
      throw Object.assign(
        new Error(error?.message || "Falha de rede ao consultar a AbacatePay."),
        {
          status: 502,
          isTransient: true,
        }
      );
    }

    throw error;
  }
}

async function abacatePayRequestWithVersionFallback({
  providerConfig = null,
  buildRequestForVersion,
} = {}) {
  let lastMismatchError = null;

  for (const apiVersion of buildApiVersionOrder(providerConfig)) {
    try {
      return await abacatePayRequest({
        ...buildRequestForVersion(apiVersion),
        apiVersion,
        providerConfig,
      });
    } catch (error) {
      if (!isApiKeyVersionMismatch(error)) throw error;
      lastMismatchError = error;
    }
  }

  throw buildVersionMismatchError(lastMismatchError);
}

function buildV1PixCustomer(customer = {}) {
  const name = String(customer?.name || "").trim();
  const cellphone = String(customer?.cellphone || "").trim();
  const email = String(customer?.email || "").trim();
  const taxId = String(customer?.taxId || "").trim();
  if (!(name && cellphone && email && taxId)) return undefined;
  return { name, cellphone, email, taxId };
}

function buildTransparentPixRequestForVersion({
  apiVersion,
  amountCents,
  description,
  expiresInSeconds,
  customer,
  metadata,
}) {
  if (apiVersion === 1) {
    const v1Customer = buildV1PixCustomer(customer);
    return {
      pathname: "/pixQrCode/create",
      payload: {
        amount: amountCents,
        expiresIn: expiresInSeconds,
        description: String(description || "Pagamento de aluguel").slice(0, 37),
        ...(v1Customer ? { customer: v1Customer } : {}),
        metadata,
      },
    };
  }

  return {
    pathname: "/transparents/create",
    payload: {
      method: "PIX",
      data: {
        amount: amountCents,
        description: description || "Pagamento de aluguel",
        expiresIn: expiresInSeconds,
        customer,
        metadata,
      },
    },
  };
}

export async function createTransparentPixCharge({
  amountCents,
  description,
  expiresInSeconds = 1800,
  customer = {},
  metadata = {},
  providerConfig = null,
} = {}) {
  return abacatePayRequestWithVersionFallback({
    providerConfig,
    buildRequestForVersion: (apiVersion) =>
      buildTransparentPixRequestForVersion({
        apiVersion,
        amountCents,
        description,
        expiresInSeconds,
        customer,
        metadata,
      }),
  });
}

export async function sendPixTransfer(payload = {}, { providerConfig = null, apiKey = null } = {}) {
  if (apiKey) {
    return abacatePayRequest({
      pathname: "/payouts/create",
      payload,
      apiVersion: 2,
      providerConfig,
      apiKey,
    });
  }

  return abacatePayRequestWithVersionFallback({
    providerConfig,
    buildRequestForVersion: (apiVersion) => ({
      pathname: apiVersion === 1 ? "/withdraw/create" : "/payouts/create",
      payload,
    }),
  });
}

export async function getPixTransferByExternalId(
  externalId,
  { providerConfig = null, apiKey = null } = {}
) {
  if (apiKey) {
    return abacatePayRequest({
      pathname: "/payouts/get",
      method: "GET",
      searchParams: {
        externalId,
      },
      apiVersion: 2,
      providerConfig,
      apiKey,
    });
  }

  return abacatePayRequestWithVersionFallback({
    providerConfig,
    buildRequestForVersion: (apiVersion) => ({
      pathname: apiVersion === 1 ? "/withdraw/get" : "/payouts/get",
      method: "GET",
      searchParams: {
        externalId,
      },
    }),
  });
}

export function sanitizeCheckoutPayload(payload = {}) {
  const data = payload?.data || payload;
  return {
    id: data?.id || null,
    amount: data?.amount ?? null,
    paidAmount: data?.paidAmount ?? null,
    status: data?.status || null,
    platformFee: data?.platformFee ?? null,
    brCode: data?.brCode || null,
    brCodeBase64: data?.brCodeBase64 || null,
    receiptUrl: data?.receiptUrl || null,
    expiresAt: data?.expiresAt || null,
    createdAt: data?.createdAt || null,
    updatedAt: data?.updatedAt || null,
    metadata: data?.metadata || {},
  };
}

export function sanitizePixTransferResponse(payload = {}) {
  return sanitizeAbacatepixTransferPayload(payload);
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

function normalizeOrigin(origin) {
  const normalized = String(origin || "").trim().replace(/\/+$/, "");
  return normalized || null;
}

export function getAbacatepayWebhookConfigStatus({ origin = "" } = {}) {
  const normalizedOrigin = normalizeOrigin(origin);
  const webhookSecret = getAbacatePayWebhookSecret();
  const webhookPublicKey = getAbacatePayWebhookPublicKey();
  const endpointPath = "/api/webhooks/abacatepay";
  const recommendedUrl = normalizedOrigin
    ? `${normalizedOrigin}${endpointPath}?providerConfigId=<provider_config_id>`
    : null;

  const missing = [];
  if (!webhookPublicKey) missing.push("ABACATEPAY_WEBHOOK_PUBLIC_KEY");
  if (!webhookSecret) missing.push("ABACATEPAY_WEBHOOK_SECRET");
  if (!normalizedOrigin) missing.push("PUBLIC_WEBHOOK_ORIGIN");

  return {
    ready: !!normalizedOrigin && !!webhookPublicKey,
    origin: normalizedOrigin,
    endpointPath,
    recommendedUrl,
    secretConfigured: !!webhookSecret,
    signatureKeyConfigured: !!webhookPublicKey,
    missing,
    recommendedWithdrawalEvents: ["payout.done", "payout.failed"],
    recommendedPaymentEvents: [
      "checkout.completed",
      "checkout.refunded",
      "checkout.disputed",
      "transparent.completed",
      "transparent.refunded",
      "transparent.disputed",
      "reconciliation.paid",
    ],
    supportedEvents: [
      "payout.done",
      "payout.failed",
      "checkout.completed",
      "checkout.refunded",
      "checkout.disputed",
      "transparent.completed",
      "transparent.refunded",
      "transparent.disputed",
      "reconciliation.paid",
    ],
  };
}

export function validateAbacatepayWebhookRequest({
  rawBody,
  signatureFromHeader,
  headers,
  providedSecret,
  expectedSecret = getAbacatePayWebhookSecret(),
  expectedPublicKey = getAbacatePayWebhookPublicKey(),
} = {}) {
  const resolvedSignature = signatureFromHeader || extractWebhookSignatureFromHeaders(headers);
  const webhookSecretConfigured = !!expectedSecret;
  const providedSecretNormalized = String(providedSecret || "").trim();
  const webhookSecretProvided = !!providedSecretNormalized;
  const webhookSecretValid = webhookSecretConfigured
    ? !webhookSecretProvided || safeCompareStrings(providedSecretNormalized, expectedSecret)
    : true;
  const signatureValid = verifyAbacatepaySignature(rawBody, resolvedSignature, expectedPublicKey);
  const signatureKeyConfigured = !!expectedPublicKey;
  const invalidProvidedSecret =
    webhookSecretConfigured && webhookSecretProvided && !webhookSecretValid;
  const secretAuthSatisfied = webhookSecretConfigured && webhookSecretProvided && webhookSecretValid;
  const signatureAuthSatisfied = signatureKeyConfigured && signatureValid;

  return {
    webhookSecretConfigured,
    webhookSecretProvided,
    webhookSecretValid,
    webhookSecretSkipped: !webhookSecretConfigured || !webhookSecretProvided,
    signatureValid,
    signatureKeyConfigured,
    allowed: !invalidProvidedSecret && (secretAuthSatisfied || signatureAuthSatisfied),
  };
}

export function sanitizeWebhookAuditInput({ headers = {}, query = {} } = {}) {
  return {
    headers: sanitizeHeadersForAudit(headers),
    query: sanitizeQueryForAudit(query),
  };
}
