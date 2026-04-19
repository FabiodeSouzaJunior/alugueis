import { NextResponse } from "next/server";
import {
  getAbacatepayWebhookConfigStatus,
  sanitizeWebhookAuditInput,
  validateAbacatepayWebhookRequest,
} from "@/server/modules/financial/abacatepay.service";
import { processAbacatepayWebhook } from "@/server/modules/financial/payment-gateway.service";
import { extractWebhookSignatureFromHeaders } from "@/server/modules/financial/owner-wallet.utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toHeadersObject(request) {
  return Object.fromEntries(request.headers.entries());
}

function logWebhook(level, event, payload = {}) {
  const writer = level === "error" ? console.error : console.info;
  writer(
    JSON.stringify({
      service: "abacatepay_webhook",
      event,
      at: new Date().toISOString(),
      ...payload,
    })
  );
}

export async function GET(request) {
  const config = getAbacatepayWebhookConfigStatus({
    origin: request.nextUrl.origin,
  });

  return NextResponse.json({
    ok: true,
    service: "abacatepay_webhook",
    config,
  });
}

export async function POST(request) {
  const headers = toHeadersObject(request);
  const queryParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const auditInput = sanitizeWebhookAuditInput({
    headers,
    query: queryParams,
  });

  try {
    const rawBody = await request.text();
    if (!rawBody) {
      return NextResponse.json({ error: "Webhook payload ausente." }, { status: 400 });
    }

    let payload = null;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      logWebhook("error", "invalid_json", {
        error: error?.message || "invalid_json",
        headers: auditInput.headers,
      });
      return NextResponse.json({ error: "Payload JSON invalido." }, { status: 400 });
    }

    const signatureFromHeader = extractWebhookSignatureFromHeaders(headers);
    const validation = validateAbacatepayWebhookRequest({
      rawBody,
      headers,
      signatureFromHeader,
      providedSecret:
        queryParams.webhookSecret ||
        queryParams.secret ||
        queryParams.token ||
        "",
    });

    const result = await processAbacatepayWebhook({
      payload,
      rawBody,
      headers: auditInput.headers,
      queryParams: auditInput.query,
      webhookSecretValid: validation.webhookSecretValid,
      signatureValid: validation.signatureValid,
    });

    logWebhook("info", "processed", {
      eventType: payload?.event || payload?.type || null,
      duplicate: !!result?.duplicate,
      eventId: result?.eventId || null,
      ok: !!result?.ok,
      status: result?.status || 200,
      validation: {
        webhookSecretValid: validation.webhookSecretValid,
        signatureValid: validation.signatureValid,
      },
    });

    const status = result?.status || 200;
    return NextResponse.json(
      {
        ok: !!result?.ok,
        duplicate: !!result?.duplicate,
        eventId: result?.eventId || null,
        validation: {
          webhookSecretConfigured: validation.webhookSecretConfigured,
          webhookSecretValid: validation.webhookSecretValid,
          webhookSecretSkipped: validation.webhookSecretSkipped,
          signatureValid: validation.signatureValid,
          signatureKeyConfigured: validation.signatureKeyConfigured,
        },
      },
      { status }
    );
  } catch (error) {
    logWebhook("error", "processing_failed", {
      message: error?.message || "webhook_processing_failed",
      headers: auditInput.headers,
      queryKeys: Object.keys(auditInput.query || {}),
    });
    return NextResponse.json(
      { error: "Nao foi possivel processar o webhook." },
      { status: error?.status || 500 }
    );
  }
}
