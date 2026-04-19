import { getSupabaseClient } from "@/database/supabaseClient";
import { generateId } from "@/lib/generateId";

const BUCKET_NAME = "tenant-contracts";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
]);
const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "png", "jpg", "jpeg"]);

function getFileExtension(fileName) {
  const parts = String(fileName || "").split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function validateContractFile(file, fileName) {
  if (!file || file.size === 0) {
    return { valid: false, error: "Arquivo vazio ou invalido." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Arquivo excede o tamanho maximo de ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
    };
  }

  const mimeType = file.type || "";
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return {
      valid: false,
      error: "Tipo de arquivo nao permitido. Envie PDF, DOC, DOCX, PNG ou JPEG.",
    };
  }

  const extension = getFileExtension(fileName);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      error: "Extensao de arquivo nao permitida. Use .pdf, .doc, .docx, .png ou .jpg.",
    };
  }

  return { valid: true, error: null };
}

let _bucketReady = false;

async function ensureBucketExists() {
  if (_bucketReady) return;

  const supabase = getSupabaseClient();
  const desiredMimeTypes = Array.from(ALLOWED_MIME_TYPES);

  const { data: buckets } = await supabase.storage.listBuckets();
  const existing = (buckets || []).find((b) => b.id === BUCKET_NAME);

  if (!existing) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: desiredMimeTypes,
    });
    if (error && !error.message?.includes("already exists")) {
      throw new Error(`Erro ao criar bucket de contratos: ${error.message}`);
    }
  } else {
    // Ensure bucket settings are up-to-date (e.g. allowed mime types)
    const currentTypes = new Set(existing.allowed_mime_types || []);
    const needsUpdate = desiredMimeTypes.some((t) => !currentTypes.has(t));
    if (needsUpdate) {
      await supabase.storage.updateBucket(BUCKET_NAME, {
        allowedMimeTypes: desiredMimeTypes,
        fileSizeLimit: MAX_FILE_SIZE,
      });
    }
  }

  _bucketReady = true;
}

let _contractColumnsReady = false;

/**
 * Garante que as colunas de contrato existem na tabela tenants.
 * Se não existirem, aplica a migration automaticamente via pg direto.
 * Lança erro se SUPABASE_DB_URL não estiver configurado.
 */
async function ensureContractColumns() {
  if (_contractColumnsReady) return;

  // Rota rápida: verifica se as colunas já existem
  const supabase = getSupabaseClient();
  const probe = await supabase.from("tenants").select("contract_file_path").limit(1);
  if (!probe.error) {
    _contractColumnsReady = true;
    return;
  }

  // Colunas ausentes — tenta auto-migration via conexão direta
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    throw Object.assign(
      new Error(
        "Colunas de contrato ausentes. Adicione SUPABASE_DB_URL em .env.local " +
          "(Supabase > Project Settings > Database > Connection string > URI) " +
          "ou execute manualmente scripts/migrations/tenant-contract-upload.sql."
      ),
      { status: 500 }
    );
  }

  const { Pool } = await import("pg");
  const pgPool = new Pool({ connectionString: dbUrl, max: 1 });
  try {
    await pgPool.query(`
      ALTER TABLE tenants
        ADD COLUMN IF NOT EXISTS contract_file_path    TEXT        DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS contract_file_name    TEXT        DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS contract_mime_type    TEXT        DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS contract_size_bytes   BIGINT      DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS contract_uploaded_at  TIMESTAMPTZ DEFAULT NULL
    `);
    _contractColumnsReady = true;
  } catch (err) {
    throw Object.assign(
      new Error(`Erro ao aplicar migracao automatica de contrato: ${err.message}`),
      { status: 500 }
    );
  } finally {
    await pgPool.end().catch(() => {});
  }
}

/** Para rotas de leitura — retorna false em vez de lançar quando colunas estão ausentes. */
async function checkContractColumns() {
  try {
    await ensureContractColumns();
    return true;
  } catch {
    return false;
  }
}

export async function uploadTenantContract(tenantId, file, fileName) {
  if (!tenantId) {
    throw Object.assign(new Error("ID do inquilino e obrigatorio."), { status: 400 });
  }

  const validation = validateContractFile(file, fileName);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.error), { status: 400 });
  }

  await ensureContractColumns();

  // Verify tenant exists
  const supabase = getSupabaseClient();
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, is_payment_responsible, contract_file_path")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantError || !tenant) {
    throw Object.assign(new Error("Inquilino nao encontrado."), { status: 404 });
  }

  await ensureBucketExists();

  // Delete old file if exists
  if (tenant.contract_file_path) {
    await supabase.storage.from(BUCKET_NAME).remove([tenant.contract_file_path]);
  }

  // Build storage path: tenantId/uniqueId.ext
  const extension = getFileExtension(fileName);
  const storagePath = `${tenantId}/${generateId()}.${extension}`;

  // Convert File/Blob to buffer for server-side upload
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw Object.assign(
      new Error(`Erro ao enviar arquivo: ${uploadError.message}`),
      { status: 500 }
    );
  }

  // Persist metadata in tenants table
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("tenants")
    .update({
      contract_file_path: storagePath,
      contract_file_name: String(fileName).trim(),
      contract_mime_type: file.type,
      contract_size_bytes: file.size,
      contract_uploaded_at: now,
      updated_at: now,
    })
    .eq("id", tenantId);

  if (updateError) {
    // Rollback: remove uploaded file to avoid orphan
    await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    throw Object.assign(
      new Error(`Erro ao salvar metadados do contrato: ${updateError.message}`),
      { status: 500 }
    );
  }

  return {
    filePath: storagePath,
    fileName: String(fileName).trim(),
    mimeType: file.type,
    sizeBytes: file.size,
    uploadedAt: now,
  };
}

export async function deleteTenantContract(tenantId) {
  if (!tenantId) {
    throw Object.assign(new Error("ID do inquilino e obrigatorio."), { status: 400 });
  }

  const columnsExist = await checkContractColumns();
  if (!columnsExist) return { ok: true };

  const supabase = getSupabaseClient();

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, contract_file_path")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantError || !tenant) {
    throw Object.assign(new Error("Inquilino nao encontrado."), { status: 404 });
  }

  if (!tenant.contract_file_path) {
    return { ok: true };
  }

  // Remove file from storage
  await supabase.storage.from(BUCKET_NAME).remove([tenant.contract_file_path]);

  // Clear metadata
  const { error: updateError } = await supabase
    .from("tenants")
    .update({
      contract_file_path: null,
      contract_file_name: null,
      contract_mime_type: null,
      contract_size_bytes: null,
      contract_uploaded_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  if (updateError) {
    throw Object.assign(
      new Error(`Erro ao remover metadados do contrato: ${updateError.message}`),
      { status: 500 }
    );
  }

  return { ok: true };
}

export async function getTenantContractInfo(tenantId) {
  const columnsExist = await checkContractColumns();
  if (!columnsExist) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("contract_file_path, contract_file_name, contract_mime_type, contract_size_bytes, contract_uploaded_at")
    .eq("id", tenantId)
    .maybeSingle();

  if (error || !data || !data.contract_file_path) return null;

  return {
    filePath: data.contract_file_path,
    fileName: data.contract_file_name,
    mimeType: data.contract_mime_type,
    sizeBytes: data.contract_size_bytes,
    uploadedAt: data.contract_uploaded_at,
  };
}

export async function getTenantContractDownloadUrl(tenantId) {
  const info = await getTenantContractInfo(tenantId);
  if (!info) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(info.filePath, 3600); // 1h expiry

  if (error) return null;
  return { ...info, signedUrl: data.signedUrl };
}
