import { NextResponse } from "next/server";
import { getCondominiumBaseAmountForMonth } from "@/lib/condominium";
import { withAuth } from "@/lib/auth";

async function _GET(request, context) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month"), 10) || new Date().getMonth() + 1;
    const year = parseInt(searchParams.get("year"), 10) || new Date().getFullYear();
    const propertyId = searchParams.get("propertyId");

    const amount = await getCondominiumBaseAmountForMonth(month, year, propertyId);
    return NextResponse.json({ amount });
  } catch (err) {
    console.error("GET /api/condominium/amount", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
