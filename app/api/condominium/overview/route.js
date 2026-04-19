import { NextResponse } from "next/server";
import { pool, rowToCondominiumBaseValue, rowToCondominiumExpense } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import {
  getBaseValueForMonth,
  getExpenseContributionForMonth,
} from "@/lib/condominium-period";

async function _GET(request, context) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month"), 10) || new Date().getMonth() + 1;
    const year = parseInt(searchParams.get("year"), 10) || new Date().getFullYear();
    const historyMonths = parseInt(searchParams.get("historyMonths"), 10) || 12;
    const propertyId = searchParams.get("propertyId");

    let baseRows;
    let expenseRows;
    if (propertyId) {
      [baseRows] = await pool.query(
        "SELECT * FROM condominium_base_values WHERE property_id = ? ORDER BY start_date DESC",
        [propertyId]
      );
      [expenseRows] = await pool.query(
        "SELECT * FROM condominium_expenses WHERE property_id = ? ORDER BY start_year DESC, start_month DESC",
        [propertyId]
      );
    } else {
      [baseRows] = await pool.query(
        "SELECT * FROM condominium_base_values ORDER BY start_date DESC"
      );
      [expenseRows] = await pool.query(
        "SELECT * FROM condominium_expenses ORDER BY start_year DESC, start_month DESC"
      );
    }

    const baseValues = (baseRows || []).map(rowToCondominiumBaseValue);
    const expenses = (expenseRows || []).map(rowToCondominiumExpense);

    const currentBase = getBaseValueForMonth(baseValues, month, year);
    let extrasTotal = 0;
    const composition = [{ label: "Condomínio base", value: currentBase }];
    const activeExpenses = [];

    for (const expense of expenses) {
      const perUnit = getExpenseContributionForMonth(expense, month, year);
      if (perUnit > 0) {
        extrasTotal += perUnit;
        composition.push({ label: expense.name, value: perUnit });
        activeExpenses.push({ ...expense, valuePerUnitThisMonth: perUnit });
      }
    }

    const totalPerUnit = currentBase + extrasTotal;
    const billingHistory = [];

    for (let index = 0; index < historyMonths; index += 1) {
      let currentMonth = month - index;
      let currentYear = year;
      while (currentMonth <= 0) {
        currentMonth += 12;
        currentYear -= 1;
      }

      const base = getBaseValueForMonth(baseValues, currentMonth, currentYear);
      let extras = 0;
      for (const expense of expenses) {
        extras += getExpenseContributionForMonth(expense, currentMonth, currentYear);
      }

      billingHistory.push({
        month: currentMonth,
        year: currentYear,
        periodLabel: `${String(currentMonth).padStart(2, "0")}/${currentYear}`,
        baseValue: base,
        extrasTotal: extras,
        totalValue: base + extras,
      });
    }

    billingHistory.sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    );

    const units = 12;
    const includeYearTotal = parseInt(searchParams.get("includeYearTotal"), 10);
    let condominiumYearByMonth = null;
    let condominiumYearTotalBuilding = null;

    if (!Number.isNaN(includeYearTotal) && includeYearTotal > 2000) {
      const includeYear = includeYearTotal;
      condominiumYearByMonth = [];
      let totalBuildingValue = 0;

      for (let currentMonth = 1; currentMonth <= 12; currentMonth += 1) {
        const base = getBaseValueForMonth(baseValues, currentMonth, includeYear);
        let extras = 0;
        for (const expense of expenses) {
          extras += getExpenseContributionForMonth(expense, currentMonth, includeYear);
        }

        const totalUnitValue = base + extras;
        const buildingTotal = totalUnitValue * units;
        condominiumYearByMonth.push({
          month: currentMonth,
          year: includeYear,
          periodLabel: `${String(currentMonth).padStart(2, "0")}/${includeYear}`,
          totalPerUnit: totalUnitValue,
          totalValue: totalUnitValue,
          buildingTotal,
        });
        totalBuildingValue += buildingTotal;
      }

      condominiumYearTotalBuilding = totalBuildingValue;
    }

    return NextResponse.json({
      currentBaseValue: currentBase,
      averagePerUnit: totalPerUnit,
      monthExpensesTotal: extrasTotal,
      worksInProgress: activeExpenses,
      composition,
      totalPerUnit,
      billingHistory,
      selectedMonth: month,
      selectedYear: year,
      condominiumYearByMonth,
      condominiumYearTotalBuilding,
    });
  } catch (err) {
    console.error("GET /api/condominium/overview", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
