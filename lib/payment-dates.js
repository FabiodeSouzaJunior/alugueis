export const DEFAULT_TENANT_PAYMENT_DAY = 10;

export function parsePaymentDay(value) {
  if (value == null || value === "") return null;

  const normalized = Number(value);
  if (!Number.isInteger(normalized)) return null;

  return normalized;
}

export function isValidPaymentDay(value) {
  const paymentDay = parsePaymentDay(value);
  return paymentDay != null && paymentDay >= 1 && paymentDay <= 31;
}

export function normalizePaymentDay(
  value,
  fallback = DEFAULT_TENANT_PAYMENT_DAY
) {
  return isValidPaymentDay(value) ? Number(value) : fallback;
}

export function getDueDateForPeriod(
  month,
  year,
  paymentDay = DEFAULT_TENANT_PAYMENT_DAY
) {
  const normalizedMonth = Number(month);
  const normalizedYear = Number(year);

  if (
    !Number.isInteger(normalizedMonth) ||
    normalizedMonth < 1 ||
    normalizedMonth > 12 ||
    !Number.isInteger(normalizedYear)
  ) {
    return null;
  }

  const lastDayOfMonth = new Date(normalizedYear, normalizedMonth, 0).getDate();
  const resolvedPaymentDay = Math.min(
    normalizePaymentDay(paymentDay),
    lastDayOfMonth
  );

  return `${String(normalizedYear).padStart(4, "0")}-${String(
    normalizedMonth
  ).padStart(2, "0")}-${String(resolvedPaymentDay).padStart(2, "0")}`;
}
