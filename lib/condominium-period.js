function getPeriodKey(month, year) {
  const normalizedMonth = Number(month);
  const normalizedYear = Number(year);
  if (!Number.isFinite(normalizedMonth) || !Number.isFinite(normalizedYear)) {
    return Number.NEGATIVE_INFINITY;
  }
  return normalizedYear * 12 + (normalizedMonth - 1);
}

function getDatePeriodKey(value) {
  if (!value) return Number.NEGATIVE_INFINITY;

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})/);
    if (match) {
      return getPeriodKey(Number(match[2]), Number(match[1]));
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return Number.NEGATIVE_INFINITY;
  return getPeriodKey(parsed.getMonth() + 1, parsed.getFullYear());
}

function getComparableDateString(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (typeof value?.toISOString === "function") return value.toISOString().slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function getBaseValueForMonth(baseValues, month, year) {
  if (!Array.isArray(baseValues) || baseValues.length === 0) return 0;

  const targetPeriodKey = getPeriodKey(month, year);
  const valid = baseValues.filter(
    (baseValue) => getDatePeriodKey(baseValue?.startDate) <= targetPeriodKey
  );

  if (valid.length === 0) return 0;

  valid.sort((a, b) =>
    getComparableDateString(b?.startDate).localeCompare(getComparableDateString(a?.startDate))
  );

  return Number(valid[0]?.value) || 0;
}

function getExpenseContributionForMonth(expense, month, year) {
  const start = Number(expense?.startYear) * 12 + Number(expense?.startMonth);
  const current = Number(year) * 12 + Number(month);
  const installmentIndex = current - start + 1;
  if (installmentIndex < 1 || installmentIndex > Number(expense?.installments)) return 0;

  const units = Math.max(1, Number(expense?.numberOfUnits));
  const installments = Math.max(1, Number(expense?.installments));
  return (Number(expense?.totalValue) || 0) / units / installments;
}

export {
  getBaseValueForMonth,
  getComparableDateString,
  getDatePeriodKey,
  getExpenseContributionForMonth,
  getPeriodKey,
};
