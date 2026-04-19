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

function getAbacatePayApiKey() {
  const apiKey = String(process.env.ABACATEPAY_API_KEY || "").trim();
  if (!apiKey) {
    throw Object.assign(new Error("ABACATEPAY_API_KEY nao configurada no backend."), {
      status: 500,
    });
  }
  return apiKey;
}

export function getAbacatePayWebhookSecret() {
  return String(process.env.ABACATEPAY_WEBHOOK_SECRET || "").trim();
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
  apiKey = getAbacatePayApiKey(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const url = new URL(`/v${apiVersion}${pathname}`, ABACATEPAY_API_ORIGIN);
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
      if (
        response.status === 401 &&
        String(errorMessage).toLowerCase().includes("api key version mismatch")
      ) {
        errorMessage =
          "Chave da AbacatePay incompativel com a versao da API chamada. A integracao usa a API v2 para envio de PIX.";
      }
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

    return data;
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

export async function createTransparentPixCharge({
  amountCents,
  description,
  expiresInSeconds = 1800,
  customer = {},
  metadata = {},
} = {}) {
  const payload = {
    method: "PIX",
    data: {
      amount: amountCents,
      description: description || "Pagamento de aluguel",
      expiresIn: expiresInSeconds,
      customer,
      metadata,
    },
  };

  return abacatePayRequest({
    pathname: "/transparents/create",
    payload,
    apiVersion: 2,
  });
}

export async function sendPixTransfer(payload = {}) {
  return abacatePayRequest({
    pathname: "/payouts/create",
    payload,
    apiVersion: 2,
  });
}

export async function getPixTransferByExternalId(externalId) {
  return abacatePayRequest({
    pathname: "/payouts/get",
    method: "GET",
    searchParams: {
      externalId,
    },
    apiVersion: 2,
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
    ? `${normalizedOrigin}${endpointPath}${
        webhookSecret ? `?webhookSecret=${encodeURIComponent(webhookSecret)}` : ""
      }`
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
} = {}) {
  const resolvedSignature = signatureFromHeader || extractWebhookSignatureFromHeaders(headers);
  const webhookSecretConfigured = !!expectedSecret;
  const providedSecretNormalized = String(providedSecret || "").trim();
  const webhookSecretProvided = !!providedSecretNormalized;
  const webhookSecretValid = webhookSecretConfigured
    ? !webhookSecretProvided || safeCompareStrings(providedSecretNormalized, expectedSecret)
    : true;
  const signatureValid = verifyAbacatepaySignature(rawBody, resolvedSignature);

  return {
    webhookSecretConfigured,
    webhookSecretProvided,
    webhookSecretValid,
    webhookSecretSkipped: !webhookSecretConfigured || !webhookSecretProvided,
    signatureValid,
    signatureKeyConfigured: !!getAbacatePayWebhookPublicKey(),
    allowed: webhookSecretValid && signatureValid,
  };
}

export function sanitizeWebhookAuditInput({ headers = {}, query = {} } = {}) {
  return {
    headers: sanitizeHeadersForAudit(headers),
    query,
  };
}
