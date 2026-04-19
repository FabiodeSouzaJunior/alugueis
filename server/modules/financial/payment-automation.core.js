import { getDueDateForPeriod } from "../../../lib/payment-dates.js";

const DEFAULT_BILLING_TIME_ZONE = "America/Sao_Paulo";

function readProcessEnv(name) {
  try {
    return globalThis?.process?.env?.[name] ?? null;
  } catch {
    return null;
  }
}

export function getBillingTimeZone() {
  return String(readProcessEnv("BILLING_TIME_ZONE") || DEFAULT_BILLING_TIME_ZONE).trim();
}

function normalizeReferenceDate(referenceDate = new Date()) {
  if (referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())) {
    return referenceDate;
  }

  const parsed = new Date(referenceDate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return new Date();
}

export function getBusinessDateParts(
  referenceDate = new Date(),
  timeZone = getBillingTimeZone()
) {
  const resolvedDate = normalizeReferenceDate(referenceDate);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(resolvedDate);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);

  return {
    year,
    month,
    day,
    isoDate: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`,
  };
}

export function getBusinessTodayIso(
  referenceDate = new Date(),
  timeZone = getBillingTimeZone()
) {
  return getBusinessDateParts(referenceDate, timeZone).isoDate;
}

export function parseDateOnly(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
      isoDate: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`,
    };
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + 1;
  const day = parsed.getUTCDate();

  return {
    year,
    month,
    day,
    isoDate: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`,
  };
}

export function getPeriodKey(month, year) {
  const normalizedMonth = Number(month);
  const normalizedYear = Number(year);

  if (
    !Number.isInteger(normalizedMonth) ||
    normalizedMonth < 1 ||
    normalizedMonth > 12 ||
    !Number.isInteger(normalizedYear)
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  return normalizedYear * 12 + (normalizedMonth - 1);
}

export function getCurrentPeriodKey({
  referenceDate = new Date(),
  timeZone = getBillingTimeZone(),
} = {}) {
  const { currentPeriod } = resolveRecurringAutomationWindow({
    referenceDate,
    timeZone,
  });

  return getPeriodKey(currentPeriod?.month, currentPeriod?.year);
}

export function getPeriodRelationToCurrent({
  month,
  year,
  referenceDate = new Date(),
  timeZone = getBillingTimeZone(),
} = {}) {
  const paymentPeriodKey = getPeriodKey(month, year);
  const currentPeriodKey = getCurrentPeriodKey({
    referenceDate,
    timeZone,
  });

  if (!Number.isFinite(paymentPeriodKey) || !Number.isFinite(currentPeriodKey)) {
    return null;
  }

  if (paymentPeriodKey < currentPeriodKey) return "past";
  if (paymentPeriodKey > currentPeriodKey) return "future";
  return "current";
}

export function periodFromKey(key) {
  const normalizedKey = Number(key);
  if (!Number.isInteger(normalizedKey) || normalizedKey < 0) return null;

  return {
    year: Math.floor(normalizedKey / 12),
    month: (normalizedKey % 12) + 1,
  };
}

export function getNextPeriod(month, year) {
  const normalizedMonth = Number(month);
  const normalizedYear = Number(year);

  if (!Number.isInteger(normalizedMonth) || !Number.isInteger(normalizedYear)) {
    return null;
  }

  if (normalizedMonth === 12) {
    return { month: 1, year: normalizedYear + 1 };
  }

  return { month: normalizedMonth + 1, year: normalizedYear };
}

export function resolveRecurringAutomationWindow({
  paymentDay,
  referenceDate = new Date(),
  timeZone = getBillingTimeZone(),
} = {}) {
  const today = getBusinessDateParts(referenceDate, timeZone);
  const currentPeriod = { month: today.month, year: today.year };
  const currentDueDate = getDueDateForPeriod(today.month, today.year, paymentDay);
  const shouldHaveNextMonth = Boolean(currentDueDate) && today.isoDate >= currentDueDate;
  const nextPeriod = getNextPeriod(today.month, today.year) || currentPeriod;

  return {
    timeZone,
    todayIsoDate: today.isoDate,
    currentDueDate,
    currentPeriod,
    targetPeriod: shouldHaveNextMonth ? nextPeriod : currentPeriod,
    shouldHaveNextMonth,
  };
}

export function buildPeriodsFromStartDate({
  startDate,
  endPeriod,
}) {
  const parsedStartDate = parseDateOnly(startDate);
  if (!parsedStartDate || !endPeriod?.month || !endPeriod?.year) return [];

  const startKey = getPeriodKey(parsedStartDate.month, parsedStartDate.year);
  const endKey = getPeriodKey(endPeriod.month, endPeriod.year);
  if (!Number.isFinite(startKey) || !Number.isFinite(endKey) || startKey > endKey) {
    return [];
  }

  const periods = [];
  for (let periodKey = startKey; periodKey <= endKey; periodKey += 1) {
    const period = periodFromKey(periodKey);
    if (period) periods.push(period);
  }

  return periods;
}

export function buildHistoricalPeriodsToCurrentMonth({
  startDate,
  referenceDate = new Date(),
  timeZone = getBillingTimeZone(),
}) {
  const window = resolveRecurringAutomationWindow({ referenceDate, timeZone });
  return buildPeriodsFromStartDate({
    startDate,
    endPeriod: window.currentPeriod,
  });
}

export function buildRecurringPeriodsToEnsure({
  startDate,
  paymentDay,
  existingPeriods = [],
  referenceDate = new Date(),
  timeZone = getBillingTimeZone(),
}) {
  const automationWindow = resolveRecurringAutomationWindow({
    paymentDay,
    referenceDate,
    timeZone,
  });
  const parsedStartDate = parseDateOnly(startDate);

  if (!parsedStartDate) {
    return {
      ...automationWindow,
      periods: [],
    };
  }

  const startKey = getPeriodKey(parsedStartDate.month, parsedStartDate.year);
  const currentKey = getPeriodKey(
    automationWindow.currentPeriod.month,
    automationWindow.currentPeriod.year
  );
  const targetKey = getPeriodKey(
    automationWindow.targetPeriod.month,
    automationWindow.targetPeriod.year
  );

  if (!Number.isFinite(startKey) || startKey > targetKey) {
    return {
      ...automationWindow,
      periods: [],
    };
  }

  const existingKeys = new Set(
    (existingPeriods || [])
      .map((period) => getPeriodKey(period?.month, period?.year))
      .filter((periodKey) => Number.isFinite(periodKey))
  );
  const missingKeys = new Set();
  const sortedExistingKeys = Array.from(existingKeys).sort((a, b) => a - b);
  const latestExistingKey = sortedExistingKeys.length
    ? sortedExistingKeys[sortedExistingKeys.length - 1]
    : null;

  if (latestExistingKey != null) {
    const recoveryStartKey = Math.max(startKey, latestExistingKey + 1);
    for (let periodKey = recoveryStartKey; periodKey <= targetKey; periodKey += 1) {
      if (!existingKeys.has(periodKey)) {
        missingKeys.add(periodKey);
      }
    }
  }

  const criticalStartKey = Math.max(startKey, currentKey);
  for (let periodKey = criticalStartKey; periodKey <= targetKey; periodKey += 1) {
    if (!existingKeys.has(periodKey)) {
      missingKeys.add(periodKey);
    }
  }

  return {
    ...automationWindow,
    periods: Array.from(missingKeys)
      .sort((a, b) => a - b)
      .map((periodKey) => periodFromKey(periodKey))
      .filter(Boolean),
  };
}

export function resolveCalculatedPaymentStatus({
  paymentDate = null,
  dueDate = null,
  amount = 0,
  expectedAmount = 0,
  todayIsoDate = getBusinessTodayIso(),
}) {
  const paidAmount = Number(amount) || 0;
  const dueAmount = Number(expectedAmount) || 0;

  if (paidAmount > 0 && dueAmount > 0 && paidAmount >= dueAmount) return "pago";
  if (paidAmount > 0) return "pendente";
  if (paymentDate) return "pago";
  if ((dueDate || "") < todayIsoDate) return "atrasado";
  return "pendente";
}

export function resolveStoredPaymentDate({
  status = "pendente",
  dueDate = null,
}) {
  return String(status || "").toLowerCase() === "pago" ? dueDate || null : null;
}
