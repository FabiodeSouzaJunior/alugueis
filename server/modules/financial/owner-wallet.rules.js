const TENANT_PORTAL_PAYMENT_SOURCES = new Set([
  "tenant_portal",
  "abacatepay_webhook",
  "abacatepay_backfill",
]);
const ADMINISTRATIVE_PAYMENT_SOURCES = new Set([
  "manual_payment_sync",
  "admin_manual",
  "admin_internal",
]);

function toSafeArray(data) {
  return Array.isArray(data) ? data : [];
}

function normalizeSource(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeMetadata(metadata = {}) {
  return metadata && typeof metadata === "object" ? metadata : {};
}

function effectiveAvailableTime(entry = {}) {
  const availableAt = entry.availableAt || entry.available_at || null;
  const createdAt = entry.createdAt || entry.created_at || null;
  const value = availableAt || createdAt || null;
  const parsed = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function normalizeOptionalCents(...values) {
  for (const value of values) {
    if (value == null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed);
  }
  return null;
}

export function isTenantPortalPaymentOrigin(entry = {}) {
  const metadata = normalizeMetadata(entry.metadata);
  const source = normalizeSource(entry.source || metadata.source);
  const paymentOrigin = normalizeSource(metadata.paymentOrigin || metadata.origin);

  return TENANT_PORTAL_PAYMENT_SOURCES.has(source) || paymentOrigin === "tenant_portal";
}

export function isMatchedTenantPortalGatewayFeeEntry(entry = {}) {
  if (!isTenantPortalPaymentOrigin(entry)) return false;

  const metadata = normalizeMetadata(entry.metadata);
  const amountCents = Math.max(0, Number(entry.amountCents ?? entry.amount_cents) || 0);
  const expectedFeeCents = normalizeOptionalCents(
    entry.checkoutFeeCents,
    entry.checkout_fee_cents,
    entry.gatewayFeeCents,
    entry.gateway_fee_cents,
    metadata.checkoutFeeCents,
    metadata.checkout_fee_cents,
    metadata.gatewayFeeCents,
    metadata.gateway_fee_cents
  );

  return expectedFeeCents == null || expectedFeeCents === amountCents;
}

export function isAdministrativePaymentOrigin(entry = {}) {
  const metadata = normalizeMetadata(entry.metadata);
  const source = normalizeSource(entry.source || metadata.source);
  const paymentOrigin = normalizeSource(metadata.paymentOrigin || metadata.origin);

  return ADMINISTRATIVE_PAYMENT_SOURCES.has(source) || paymentOrigin === "admin_manual";
}

export function isTenantPortalPaymentCreditEntry(entry = {}) {
  const entryType = String(entry.entryType || entry.entry_type || "");
  const direction = String(entry.direction || "");

  return (
    entryType === "payment_credit" &&
    direction === "credit" &&
    isTenantPortalPaymentOrigin(entry)
  );
}

export function shouldDisplayOwnerLedgerEntry(entry = {}) {
  const entryType = String(entry.entryType || entry.entry_type || "");

  if (entryType === "manual_adjustment_credit" || entryType === "manual_adjustment_debit") {
    return false;
  }

  if (isAdministrativePaymentOrigin(entry)) {
    return false;
  }

  return true;
}

export function buildWithdrawableBalanceSnapshot(entries = [], now = new Date()) {
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const safeNowTime = Number.isFinite(nowTime) ? nowTime : Date.now();

  const snapshot = {
    grossCents: 0,
    pendingCents: 0,
    availableCreditsCents: 0,
    reservedCents: 0,
    blockedCents: 0,
    directDebitsCents: 0,
    availableCents: 0,
  };

  for (const entry of toSafeArray(entries)) {
    const entryType = String(entry.entryType || entry.entry_type || "");
    const direction = String(entry.direction || "");
    const amountCents = Math.max(0, Number(entry.amountCents ?? entry.amount_cents) || 0);
    if (amountCents <= 0) continue;

    if (isTenantPortalPaymentCreditEntry(entry)) {
      snapshot.grossCents += amountCents;
      if (effectiveAvailableTime(entry) > safeNowTime) {
        snapshot.pendingCents += amountCents;
      } else {
        snapshot.availableCreditsCents += amountCents;
      }
      continue;
    }

    if (entryType === "withdrawal_reservation" || entryType === "withdrawal_reservation_release") {
      snapshot.reservedCents += direction === "debit" ? amountCents : -amountCents;
      continue;
    }

    if (entryType === "dispute_hold" || entryType === "dispute_release") {
      snapshot.blockedCents += direction === "debit" ? amountCents : -amountCents;
      continue;
    }

    if (entryType === "gateway_fee_debit" && isMatchedTenantPortalGatewayFeeEntry(entry)) {
      snapshot.directDebitsCents += direction === "debit" ? amountCents : -amountCents;
      continue;
    }

    if (
      entryType === "platform_fee_debit" ||
      entryType === "withdrawal_debit" ||
      entryType === "refund_debit" ||
      entryType === "chargeback_debit"
    ) {
      snapshot.directDebitsCents += direction === "debit" ? amountCents : -amountCents;
    }
  }

  snapshot.reservedCents = Math.max(snapshot.reservedCents, 0);
  snapshot.blockedCents = Math.max(snapshot.blockedCents, 0);
  snapshot.directDebitsCents = Math.max(snapshot.directDebitsCents, 0);
  snapshot.availableCents = Math.max(
    snapshot.availableCreditsCents -
      snapshot.directDebitsCents -
      snapshot.reservedCents -
      snapshot.blockedCents,
    0
  );

  return snapshot;
}
