import { NextResponse } from "next/server";
import { pool, rowToResidentEvaluation } from "@/lib/db";
import { generateId } from "@/lib/generateId";

export async function POST(request) {
  try {
    const body = await request.json();
    const id = body.id || generateId();
    const tenantName = body.tenantName ?? body.tenant_name ?? "";
    const contact = body.contact ?? null;
    const kitnetNumber = body.kitnetNumber ?? body.kitnet_number ?? null;
    const comfortRating = (body.comfortRating ?? body.comfort_rating) != null ? Number(body.comfortRating ?? body.comfort_rating) : null;
    const cleanlinessRating = (body.cleanlinessRating ?? body.cleanliness_rating) != null ? Number(body.cleanlinessRating ?? body.cleanliness_rating) : null;
    const infrastructureRating = (body.infrastructureRating ?? body.infrastructure_rating) != null ? Number(body.infrastructureRating ?? body.infrastructure_rating) : null;
    const locationRating = (body.locationRating ?? body.location_rating) != null ? Number(body.locationRating ?? body.location_rating) : null;
    const costBenefitRating = (body.costBenefitRating ?? body.cost_benefit_rating) != null ? Number(body.costBenefitRating ?? body.cost_benefit_rating) : null;
    const overallRating = (body.overallRating ?? body.overall_rating) != null ? Number(body.overallRating ?? body.overall_rating) : null;
    const recommendation = body.recommendation ?? null;
    const comment = body.comment ?? null;
    let categories = body.categories;
    if (Array.isArray(categories)) {
      categories = JSON.stringify(categories);
    } else if (categories != null) {
      categories = JSON.stringify([]);
    } else {
      categories = null;
    }

    if (!tenantName.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO resident_evaluations (
        id, tenant_name, contact, kitnet_number,
        comfort_rating, cleanliness_rating, infrastructure_rating, location_rating, cost_benefit_rating, overall_rating,
        recommendation, comment, categories
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantName.trim(),
        contact && String(contact).trim() ? String(contact).trim() : null,
        kitnetNumber != null && String(kitnetNumber).trim() ? String(kitnetNumber).trim() : null,
        comfortRating,
        cleanlinessRating,
        infrastructureRating,
        locationRating,
        costBenefitRating,
        overallRating,
        recommendation,
        comment && String(comment).trim() ? String(comment).trim() : null,
        categories,
      ]
    );

    const [rows] = await pool.query("SELECT * FROM resident_evaluations WHERE id = ?", [id]);
    return NextResponse.json(rowToResidentEvaluation(rows[0]));
  } catch (err) {
    console.error("POST /api/avaliacao", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
