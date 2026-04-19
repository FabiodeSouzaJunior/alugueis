import { pool, rowToCondominiumBaseValue, rowToCondominiumExpense } from "@/lib/db";
import {
  getBaseValueForMonth,
  getExpenseContributionForMonth,
} from "@/lib/condominium-period";

async function listCondominiumBaseValues(propertyId) {
  if (propertyId) {
    const [rows] = await pool.query(
      "SELECT * FROM condominium_base_values WHERE property_id = ? ORDER BY start_date DESC",
      [propertyId]
    );
    return (rows || []).map(rowToCondominiumBaseValue);
  }

  const [rows] = await pool.query(
    "SELECT * FROM condominium_base_values ORDER BY start_date DESC"
  );
  return (rows || []).map(rowToCondominiumBaseValue);
}

async function listCondominiumExpenses(propertyId) {
  if (propertyId) {
    const [rows] = await pool.query(
      "SELECT * FROM condominium_expenses WHERE property_id = ? ORDER BY start_year DESC, start_month DESC",
      [propertyId]
    );
    return (rows || []).map(rowToCondominiumExpense);
  }

  const [rows] = await pool.query(
    "SELECT * FROM condominium_expenses ORDER BY start_year DESC, start_month DESC"
  );
  return (rows || []).map(rowToCondominiumExpense);
}

export async function getCondominiumBaseAmountForMonth(month, year, propertyId) {
  const baseValues = await listCondominiumBaseValues(propertyId);
  const base = getBaseValueForMonth(baseValues, month, year);
  return Number(base) || 0;
}

export async function getCondominiumTotalAmountForMonth(month, year, propertyId) {
  const base = await getCondominiumBaseAmountForMonth(month, year, propertyId);
  const expenses = await listCondominiumExpenses(propertyId);

  let extras = 0;
  for (const expense of expenses) {
    extras += getExpenseContributionForMonth(expense, month, year);
  }

  return base + extras;
}

// Backward-compatible billing helper: for cobrança do inquilino, só o valor base entra.
export async function getCondominiumAmountForMonth(month, year, propertyId) {
  return getCondominiumBaseAmountForMonth(month, year, propertyId);
}

export async function getCondominiumChargeWithRent(propertyId) {
  try {
    const settingsId = propertyId || "default";
    const [rows] = await pool.query(
      "SELECT charge_with_rent FROM condominium_settings WHERE id = ?",
      [settingsId]
    );
    if (!rows || rows.length === 0) return true;
    return Boolean(rows[0].charge_with_rent);
  } catch {
    return true;
  }
}
