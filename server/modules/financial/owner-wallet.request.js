function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export function readPaginationFromRequest(request, defaults = {}) {
  const url = new URL(request.url);
  return {
    limit: clampInteger(url.searchParams.get("limit"), defaults.limit ?? 20, 1, 100),
    offset: clampInteger(url.searchParams.get("offset"), defaults.offset ?? 0, 0, 100000),
  };
}

export function normalizeOwnerWithdrawalPayload(body = {}) {
  return {
    payoutMethodId: body?.payoutMethodId ? String(body.payoutMethodId).trim() : "",
    amount: body?.amount ?? "",
    idempotencyKey: body?.idempotencyKey ? String(body.idempotencyKey).trim() : "",
    note: body?.note ? String(body.note).trim().slice(0, 500) : null,
  };
}

export function normalizeOwnerPayoutMethodPayload(body = {}) {
  return {
    ownerId: body?.ownerId ? String(body.ownerId).trim() : "",
    pixKeyType: body?.pixKeyType ? String(body.pixKeyType).trim() : "",
    pixKeyValue: body?.pixKeyValue ? String(body.pixKeyValue).trim() : "",
    holderName: body?.holderName ? String(body.holderName).trim().slice(0, 255) : null,
    holderTaxId: body?.holderTaxId ? String(body.holderTaxId).trim().slice(0, 32) : null,
    makeDefault: body?.makeDefault !== false,
  };
}

export function normalizeOwnerWithdrawalResolutionPayload(body = {}) {
  const failureReason = body?.failureReason ? String(body.failureReason).trim().slice(0, 500) : "";
  const providerResponse =
    body?.providerResponse && typeof body.providerResponse === "object" && !Array.isArray(body.providerResponse)
      ? body.providerResponse
      : {};

  return {
    resolution: body?.resolution ? String(body.resolution).trim().toLowerCase() : "",
    failureReason: failureReason || null,
    providerResponse,
  };
}
