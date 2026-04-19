import { getSupabaseClient } from "@/database/supabaseClient";

function normalizeSql(sql) {
  return String(sql || "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasUnsupported(sql) {
  const s = sql.toUpperCase();
  if (s.includes("JOIN ") || s.includes("LEFT JOIN") || s.includes("SUM(") || s.includes("GROUP BY")) return true;
  if (s.includes("ALTER TABLE")) return true;
  if (s.includes("LOWER(")) return true;
  if (s.includes(" OR ")) return true;
  if (/\sIN\s*\(/i.test(sql)) return true;
  return false;
}

function parseSelectColumns(sql) {
  const m = sql.match(/SELECT\s+(.+?)\s+FROM\s+/i);
  if (!m) return "*";
  const cols = m[1].trim().replace(/^DISTINCT\s+/i, "");
  if (cols === "*" || cols.toUpperCase() === "*)") return "*";
  return cols;
}

function parseTableNameFromSql(sql) {
  const m = sql.match(/\bFROM\s+([A-Za-z0-9_]+)\b/i);
  return m?.[1] || null;
}

function parseWhereClause(sql) {
  const m = sql.match(/\bWHERE\s+(.+?)(?:\s+ORDER BY|\s+LIMIT|\s+OFFSET|$)/i);
  return m?.[1]?.trim() || null;
}

function parseOrderBy(sql) {
  const m = sql.match(/ORDER BY\s+(.+?)(?:\s+LIMIT|\s+OFFSET|$)/i);
  if (!m) return null;
  const orderPart = m[1].trim();
  const first = orderPart.split(",")[0].trim();
  const mm = first.match(/^([A-Za-z0-9_\.]+)(?:\s+(ASC|DESC))?\s*$/i);
  if (!mm) return null;
  return { column: mm[1].replace(/\./g, "_"), ascending: String(mm[2] || "ASC").toUpperCase() !== "DESC" };
}

function parseLimitOffset(sql) {
  const hasLimit = /\bLIMIT\s+\?/i.test(sql);
  if (!hasLimit) return null;
  return { hasLimit, hasOffset: /\bOFFSET\s+\?/i.test(sql) };
}

function stripOuterParentheses(str) {
  let s = String(str || "").trim();
  if (s.startsWith("(") && s.endsWith(")")) s = s.slice(1, -1).trim();
  return s;
}

function parseWhereAndConditions(whereClause) {
  if (!whereClause) return [];
  const s = stripOuterParentheses(whereClause).replace(/\s+/g, " ").trim();
  return s.split(/\s+AND\s+/i).map((p) => p.trim()).filter(Boolean);
}

function parseEqStringCondition(cond) {
  const m = cond.match(/^([A-Za-z0-9_]+)\s*=\s*'([^']*)'$/i);
  if (!m) return null;
  return { column: m[1], value: m[2] };
}

function parseNeqStringCondition(cond) {
  const m = cond.match(/^([A-Za-z0-9_]+)\s*!=\s*'([^']*)'$/i);
  if (!m) return null;
  return { column: m[1], value: m[2] };
}

function parseEqParamCondition(cond) {
  const m = cond.match(/^([A-Za-z0-9_]+)\s*=\s*\?$/i);
  if (!m) return null;
  return { column: m[1] };
}

function parseIsNullCondition(cond) {
  const m = cond.match(/^([A-Za-z0-9_]+)\s+IS\s+NULL$/i);
  if (!m) return null;
  return { column: m[1] };
}

function parseIsNotNullCondition(cond) {
  const m = cond.match(/^([A-Za-z0-9_]+)\s+IS\s+NOT\s+NULL$/i);
  if (!m) return null;
  return { column: m[1] };
}

async function applyWhereToQuery(builder, whereClause, values, startIndex) {
  const parts = parseWhereAndConditions(whereClause);
  let vIndex = startIndex;
  for (const part of parts) {
    if (!part) continue;
    if (/^1\s*=\s*1$/i.test(part)) continue;
    const asNull = parseIsNullCondition(part);
    if (asNull) {
      builder = builder.is(asNull.column, null);
      continue;
    }
    const asNotNull = parseIsNotNullCondition(part);
    if (asNotNull) {
      builder = builder.not(asNotNull.column, "is", null);
      continue;
    }
    const eqStr = parseEqStringCondition(part);
    if (eqStr) {
      builder = builder.eq(eqStr.column, eqStr.value);
      continue;
    }
    const neqStr = parseNeqStringCondition(part);
    if (neqStr) {
      builder = builder.neq(neqStr.column, neqStr.value);
      continue;
    }
    const eqParam = parseEqParamCondition(part);
    if (eqParam) {
      builder = builder.eq(eqParam.column, values[vIndex]);
      vIndex += 1;
      continue;
    }
    throw new Error(`Unsupported WHERE condition: ${part}`);
  }
  return { builder, nextIndex: vIndex };
}

function applyOrderToQuery(builder, sql) {
  const ord = parseOrderBy(sql);
  if (!ord) return builder;
  return builder.order(ord.column, { ascending: ord.ascending });
}

function applyRangeToQuery(builder, sql, values, startIndex) {
  const lim = parseLimitOffset(sql);
  if (!lim) return { builder, nextIndex: startIndex };
  const limit = values[startIndex];
  let nextIndex = startIndex + 1;
  let offset = 0;
  if (lim.hasOffset) {
    offset = values[nextIndex];
    nextIndex += 1;
  }
  const from = Number(offset) || 0;
  const to = from + (Number(limit) || 0) - 1;
  return { builder: builder.range(from, to), nextIndex };
}

async function handleSelect(sql, values) {
  const supabase = getSupabaseClient();
  const table = parseTableNameFromSql(sql);
  if (!table) throw new Error(`Unable to parse SELECT table: ${sql}`);
  const columns = parseSelectColumns(sql);

  let query = supabase.from(table).select(columns === "*" ? "*" : columns);
  query = applyOrderToQuery(query, sql);

  let nextIndex = 0;
  const whereClause = parseWhereClause(sql);
  if (whereClause) {
    const res = await applyWhereToQuery(query, whereClause, values, nextIndex);
    query = res.builder;
    nextIndex = res.nextIndex;
  }

  const rangeRes = applyRangeToQuery(query, sql, values, nextIndex);
  query = rangeRes.builder;
  nextIndex = rangeRes.nextIndex;

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

function parseInsert(sql) {
  const m = sql.match(/INSERT INTO\s+([A-Za-z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
  if (!m) return null;
  const table = m[1];
  const columns = m[2].split(",").map((c) => c.trim());
  const valuesExpr = m[3];
  const valuesTokens = splitSqlValuesList(valuesExpr);
  return { table, columns, valuesTokens };
}

function splitSqlValuesList(valuesExpr) {
  const s = String(valuesExpr || "").trim();
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'") {
      const next = s[i + 1];
      if (inQuotes && next === "'") {
        cur += "''";
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      cur += ch;
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }

  if (cur.trim() !== "") out.push(cur.trim());
  return out;
}

const orgColumnCache = new Map();

async function tableHasOrganizationId(supabase, table) {
  if (!table || table === "organizations") return false;
  if (orgColumnCache.has(table)) return orgColumnCache.get(table);
  const probe = await supabase.from(table).select("organization_id").limit(1);
  const has = !probe.error;
  orgColumnCache.set(table, has);
  return has;
}

async function getOrganizationIdFromProperty(supabase, propertyId) {
  if (!propertyId) return null;
  const { data, error } = await supabase
    .from("properties")
    .select("organization_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (error) return null;
  return data?.organization_id ?? null;
}

async function getOrganizationIdFromTenant(supabase, tenantId) {
  if (!tenantId) return null;
  const { data, error } = await supabase
    .from("tenants")
    .select("organization_id,property_id")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || !data) return null;
  if (data.organization_id) return data.organization_id;
  return getOrganizationIdFromProperty(supabase, data.property_id);
}

async function getOrganizationIdFromObra(supabase, obraId) {
  if (!obraId) return null;
  const { data, error } = await supabase
    .from("obras")
    .select("organization_id,property_id")
    .eq("id", obraId)
    .maybeSingle();
  if (error || !data) return null;
  if (data.organization_id) return data.organization_id;
  return getOrganizationIdFromProperty(supabase, data.property_id);
}

async function ensureOrganizationIdForInsert(supabase, table, row) {
  const hasOrganizationId = await tableHasOrganizationId(supabase, table);
  if (!hasOrganizationId) return row;

  if (row.organization_id != null && String(row.organization_id).trim() !== "") {
    return row;
  }

  let organizationId = null;
  if (row.tenant_id) {
    organizationId = await getOrganizationIdFromTenant(supabase, row.tenant_id);
  }
  if (!organizationId && row.property_id) {
    organizationId = await getOrganizationIdFromProperty(supabase, row.property_id);
  }
  if (!organizationId && row.obra_id) {
    organizationId = await getOrganizationIdFromObra(supabase, row.obra_id);
  }
  if (!organizationId) {
    throw new Error(
      `Missing organization_id for table '${table}'. organization_id is required for all inserts.`
    );
  }

  return { ...row, organization_id: organizationId };
}

async function handleInsert(sql, values) {
  const supabase = getSupabaseClient();
  const parsed = parseInsert(sql);
  if (!parsed) throw new Error(`Unable to parse INSERT: ${sql}`);

  const { table, columns, valuesTokens } = parsed;
  if (!Array.isArray(valuesTokens) || valuesTokens.length !== columns.length) {
    throw new Error(`Unable to align INSERT values for ${table}`);
  }

  const row = {};
  let vIndex = 0;
  const nowIso = new Date().toISOString();

  columns.forEach((col, idx) => {
    const token = String(valuesTokens[idx] ?? "").trim();
    const upper = token.toUpperCase();

    if (token === "?") {
      row[col] = values[vIndex];
      vIndex += 1;
      return;
    }

    if (upper === "NULL") {
      row[col] = null;
      return;
    }

    if (upper === "CURRENT_TIMESTAMP") {
      row[col] = nowIso;
      return;
    }

    if (token.startsWith("'") && token.endsWith("'") && token.length >= 2) {
      const inner = token.slice(1, -1).replace(/''/g, "'");
      row[col] = inner;
      return;
    }

    if (/^-?\d+(\.\d+)?$/.test(token)) {
      row[col] = Number(token);
      return;
    }

    throw new Error(`Unsupported INSERT literal token: ${token}`);
  });

  const safeRow = await ensureOrganizationIdForInsert(supabase, table, row);
  const { error } = await supabase.from(table).insert(safeRow);
  if (error) throw error;
  return { affectedRows: 1 };
}

function parseUpdateTable(sql) {
  const m = sql.match(/UPDATE\s+([A-Za-z0-9_]+)\s+SET\s+/i);
  return m?.[1] || null;
}

function parseAssignments(sql) {
  const m = sql.match(/\bSET\s+(.+?)\s+WHERE\s+/i);
  return m?.[1]?.trim() || null;
}

function parseDeleteTable(sql) {
  const m = sql.match(/DELETE FROM\s+([A-Za-z0-9_]+)\b/i);
  return m?.[1] || null;
}

async function handleUpdate(sql, values) {
  const supabase = getSupabaseClient();
  if (/\bCOALESCE\s*\(\s*\?\s*,\s*date\s*\)/i.test(sql)) {
    const table = parseUpdateTable(sql);
    if (table !== "obra_costs") throw new Error(`Unsupported COALESCE update target: ${table}`);

    const purchaseOrCostDate = values[0] ?? null;
    const description = values[1];
    const value = values[2];
    const obraId = values[3];
    const materialId = values[4];

    const { data: existing, error: readErr } = await supabase
      .from(table)
      .select("date")
      .eq("obra_id", obraId)
      .eq("reference_type", "material")
      .eq("reference_id", materialId)
      .maybeSingle();
    if (readErr) throw readErr;

    const finalDate = purchaseOrCostDate ?? existing?.date ?? null;

    const { error: updErr } = await supabase
      .from(table)
      .update({
        date: finalDate,
        description,
        value,
        updated_at: new Date().toISOString(),
      })
      .eq("obra_id", obraId)
      .eq("reference_type", "material")
      .eq("reference_id", materialId);
    if (updErr) throw updErr;

    return { affectedRows: 1 };
  }

  const table = parseUpdateTable(sql);
  if (!table) throw new Error(`Unable to parse UPDATE table: ${sql}`);
  const setClause = parseAssignments(sql);
  const whereClause = parseWhereClause(sql);
  if (!setClause || !whereClause) throw new Error(`Unable to parse UPDATE statement: ${sql}`);

  const setParts = setClause.split(",").map((p) => p.trim()).filter(Boolean);
  let vIndex = 0;
  const nowIso = new Date().toISOString();
  const updateRow = {};

  for (const part of setParts) {
    const mParam = part.match(/^([A-Za-z0-9_]+)\s*=\s*\?$/i);
    if (mParam) {
      updateRow[mParam[1]] = values[vIndex];
      vIndex += 1;
      continue;
    }
    const mNow = part.match(/^([A-Za-z0-9_]+)\s*=\s*CURRENT_TIMESTAMP$/i);
    if (mNow) {
      updateRow[mNow[1]] = nowIso;
      continue;
    }
    if (/COALESCE/i.test(part)) continue;
    throw new Error(`Unsupported UPDATE assignment: ${part}`);
  }

  let query = supabase.from(table).update(updateRow).select("id");
  const resWhere = await applyWhereToQuery(query, whereClause, values, vIndex);
  query = resWhere.builder;

  const { data, error } = await query;
  if (error) throw error;
  return { affectedRows: (data || []).length };
}

async function handleDelete(sql, values) {
  const supabase = getSupabaseClient();
  const table = parseDeleteTable(sql);
  if (!table) throw new Error(`Unable to parse DELETE table: ${sql}`);
  const whereClause = parseWhereClause(sql);
  if (!whereClause) throw new Error(`Unable to parse DELETE WHERE: ${sql}`);

  let query = supabase.from(table).delete().select("id");
  const resWhere = await applyWhereToQuery(query, whereClause, values, 0);
  query = resWhere.builder;
  const { data, error } = await query;
  if (error) throw error;
  return { affectedRows: (data || []).length };
}

async function query(text, values = []) {
  const sql = normalizeSql(text);
  const v = Array.isArray(values) ? values : [];

  if (hasUnsupported(sql)) {
    const err = new Error(`Unsupported SQL for Supabase adapter: ${sql}`);
    err.code = "UNSUPPORTED_SQL";
    throw err;
  }

  if (/^\s*SELECT\b/i.test(sql)) {
    const rows = await handleSelect(sql, v);
    return [rows];
  }
  if (/^\s*INSERT\b/i.test(sql)) {
    const result = await handleInsert(sql, v);
    return [result];
  }
  if (/^\s*UPDATE\b/i.test(sql)) {
    const result = await handleUpdate(sql, v);
    return [result];
  }
  if (/^\s*DELETE\b/i.test(sql)) {
    const result = await handleDelete(sql, v);
    return [result];
  }

  throw new Error(`Unsupported SQL statement: ${sql}`);
}

const pool = { query };

export { pool };
