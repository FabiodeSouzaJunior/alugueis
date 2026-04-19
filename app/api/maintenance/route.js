import { NextResponse } from "next/server";
import { pool, rowToMaintenance } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { createNotification } from "@/lib/notificationService";
import { withAuth } from "@/lib/auth";

const ALLOWED_PRIORITIES = new Set(["alta", "media", "baixa"]);
const ALLOWED_STATUS = new Set(["pendente", "em_andamento", "concluido"]);

async function _GET(request, context) {
  try {
    const [rows] = await pool.query(
      "SELECT id, type, location, description, priority, status, spent_value, created_at, updated_at FROM maintenance ORDER BY created_at DESC"
    );
    const list = rows.map(rowToMaintenance);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/maintenance", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _POST(request, context) {
  try {
    const body = await request.json();
    const id = body.id || generateId();
    const type = body.type ?? "";
    const location = body.location ?? null;
    const description = body.description ?? null;
    const rawPriority = String(body.priority ?? "").trim().toLowerCase();
    const priority = ALLOWED_PRIORITIES.has(rawPriority) ? rawPriority : "media";
    const rawStatus = String(body.status ?? "").trim().toLowerCase();
    const status = ALLOWED_STATUS.has(rawStatus) ? rawStatus : "pendente";
    const spentNum = Number(body.spentValue);
    const spentValue = Number.isFinite(spentNum) ? spentNum : NaN;
    if (!Number.isFinite(spentValue) || spentValue < 0) {
      return NextResponse.json({ error: "Valor gasto invalido." }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO maintenance (id, type, location, description, priority, status, spent_value)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, type, location, description, priority, status, spentValue]
    );

    // Se houver valor gasto, registra automaticamente em despesas.
    if (spentValue > 0) {
      const expenseId = generateId();
      const expenseType = "Manutenção";
      const expenseDate = new Date().toISOString().split("T")[0];
      const expenseDescriptionParts = [
        type ? `Tipo: ${type}` : null,
        location ? `Local: ${location}` : null,
        description ? `Detalhes: ${description}` : null,
      ].filter(Boolean);
      const expenseDescription =
        expenseDescriptionParts.length > 0
          ? expenseDescriptionParts.join(" | ")
          : "Despesa gerada automaticamente a partir de manutenção.";

      await pool.query(
        `INSERT INTO expenses (id, type, value, date, description)
         VALUES (?, ?, ?, ?, ?)`,
        [expenseId, expenseType, spentValue, expenseDate, expenseDescription]
      );
    }
    createNotification({
      type: "maintenance_added",
      title: "Nova manutenção registrada",
      message: location ? `${type} — ${location}` : type || "Manutenção",
      relatedEntity: "maintenance",
      relatedId: id,
      linkHref: "/manutencao",
    }).catch(() => {});

    const [rows] = await pool.query("SELECT * FROM maintenance WHERE id = ?", [id]);
    return NextResponse.json(rowToMaintenance(rows[0]));
  } catch (err) {
    console.error("POST /api/maintenance", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
