function normalizeMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function calculateTenantAmountDue({
  rentValue,
  condominiumValue = 0,
  extraCharges = 0,
}) {
  return (
    normalizeMoney(rentValue) +
    normalizeMoney(condominiumValue) +
    normalizeMoney(extraCharges)
  );
}

export { calculateTenantAmountDue, normalizeMoney };
