import { pool } from "@/lib/db";
import { generateId } from "@/lib/generateId";

/**
 * Cria uma notificação no banco. Usado pelas rotas de API quando ocorrem eventos.
 * @param {{ type: string, title: string, message?: string, relatedEntity?: string, relatedId?: string, linkHref?: string }} payload
 * @returns {Promise<object|null>}
 */
export async function createNotification(payload) {
  if (!payload?.type || !payload?.title) return null;
  const id = payload.id || generateId();
  const type = String(payload.type);
  const title = String(payload.title);
  const message = payload.message != null ? String(payload.message) : null;
  const relatedEntity = payload.relatedEntity != null ? String(payload.relatedEntity) : null;
  const relatedId = payload.relatedId != null ? String(payload.relatedId) : null;
  const linkHref = payload.linkHref != null ? String(payload.linkHref) : null;
  try {
    await pool.query(
      `INSERT INTO notifications (id, type, title, message, related_entity, related_id, link_href)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, type, title, message, relatedEntity, relatedId, linkHref]
    );
    const [rows] = await pool.query("SELECT * FROM notifications WHERE id = ?", [id]);
    return rows[0] ?? { id, type, title, message, relatedEntity, relatedId, linkHref };
  } catch (err) {
    console.error("createNotification", err);
    return null;
  }
}
