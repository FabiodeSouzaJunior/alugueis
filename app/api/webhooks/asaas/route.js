import { NextResponse } from "next/server";
import {
  getAsaasWebhookConfigStatus,
  sanitizeAsaasWebhookAuditInput,
} from "@/server/modules/financial/asaas.service";
import { processAsaasWebhook } from "@/server/modules/financial/payment-gateway.service";

function headersToObject(headers) {
  return Object.fromEntries(headers.entries());
}

function queryToObject(searchParams) {
  return Object.fromEntries(searchParams.entries());
}

export async function GET(request) {
  const origin =
    process.env.PUBLIC_WEBHOOK_ORIGIN ||
    process.env.NEXT_PUBLIC_APP_URL ||
    request.headers.get("origin") ||
    "";

  return NextResponse.json({
    service: "asaas_webhook",
    ...getAsaasWebhookConfigStatus({ origin }),
  });
}

export async function POST(request) {
  const rawBody = await request.text();
  const headers = headersToObject(request.headers);
  const queryParams = queryToObject(new URL(request.url).searchParams);
  const auditInput = sanitizeAsaasWebhookAuditInput({
    headers,
    query: queryParams,
  });

  let payload = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    console.warn(
      JSON.stringify({
        service: "asaas_webhook",
        event: "invalid_json",
        ...auditInput,
      })
    );
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const result = await processAsaasWebhook({
      payload,
      rawBody,
      headers: auditInput.headers,
      queryParams: auditInput.query,
      providedToken: request.headers.get("asaas-access-token") || "",
    });

    if (result?.ok === false) {
      return NextResponse.json(
        { ok: false, eventId: result.eventId || null },
        { status: result.status || 401 }
      );
    }

    return NextResponse.json({ ok: true, eventId: result?.eventId || null });
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "asaas_webhook",
        event: "processing_failed",
        message: error?.message || "asaas_webhook_failed",
        ...auditInput,
      })
    );
    return NextResponse.json(
      { error: error?.message || "Nao foi possivel processar webhook ASAAS." },
      { status: error?.status || 500 }
    );
  }
}
