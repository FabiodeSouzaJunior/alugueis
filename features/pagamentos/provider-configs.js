import { getServiceRoleClient } from "@/database/supabaseClient";

const MIN_ENCRYPTION_KEY_LENGTH = 32;
const DEFAULT_PROVIDER = "abacatepay";

function normalizeProvider(provider) {
  return String(provider || DEFAULT_PROVIDER)
    .trim()
    .toLowerCase();
}

function normalizeNullableString(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function unwrapSingleRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

function getProviderConfigEncryptionKey() {
  const encryptionKey = String(process.env.PAYMENT_PROVIDER_CONFIG_ENCRYPTION_KEY || "").trim();
  if (encryptionKey.length < MIN_ENCRYPTION_KEY_LENGTH) {
    throw Object.assign(
      new Error("PAYMENT_PROVIDER_CONFIG_ENCRYPTION_KEY nao configurada no backend."),
      { status: 500, code: "provider_config_encryption_key_missing" }
    );
  }
  return encryptionKey;
}

function providerConfigStoreUnavailable(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "42P01" ||
    error?.code === "42883" ||
    message.includes("organization_payment_provider_configs") ||
    message.includes("get_payment_provider_config_decrypted")
  );
}

function buildProviderConfigError(message, status = 500, code = "provider_config_error") {
  return Object.assign(new Error(message), { status, code });
}

function mapProviderConfigRow(row = {}) {
  const provider = normalizeProvider(row.provider);
  const providerAccountId = normalizeNullableString(row.provider_account_id);
  const environment = normalizeNullableString(row.environment) || "production";

  return {
    id: row.id,
    organizationId: row.organization_id,
    provider,
    isActive: row.is_active !== false,
    environment,
    apiKey: normalizeNullableString(row.api_key),
    webhookSecret: normalizeNullableString(row.webhook_secret),
    webhookPublicKey: normalizeNullableString(row.webhook_public_key),
    providerAccountName: normalizeNullableString(row.provider_account_name),
    providerAccountId,
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function fetchDecryptedProviderConfig({
  configId = null,
  organizationId = null,
  provider = DEFAULT_PROVIDER,
  activeOnly = false,
} = {}) {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedConfigId = normalizeNullableString(configId);
  const normalizedOrganizationId = normalizeNullableString(organizationId);

  if (!normalizedConfigId && !normalizedOrganizationId) {
    throw buildProviderConfigError(
      "Informe a organizacao ou o id da configuracao do provider.",
      400,
      "provider_config_scope_missing"
    );
  }

  const serviceClient = getServiceRoleClient();
  const { data, error } = await serviceClient.rpc("get_payment_provider_config_decrypted", {
    p_config_id: normalizedConfigId,
    p_organization_id: normalizedOrganizationId,
    p_provider: normalizedProvider,
    p_active_only: !!activeOnly,
    p_encryption_key: getProviderConfigEncryptionKey(),
  });

  if (error) {
    if (providerConfigStoreUnavailable(error)) {
      throw buildProviderConfigError(
        "Tabela/RPC de configuracao de providers de pagamento nao encontrada.",
        500,
        "provider_config_store_missing"
      );
    }
    throw error;
  }

  const config = mapProviderConfigRow(unwrapSingleRow(data) || {});
  if (!config.id) {
    throw buildProviderConfigError(
      activeOnly
        ? "Configuracao AbacatePay ativa nao encontrada para a organizacao."
        : "Configuracao AbacatePay vinculada ao registro nao encontrada.",
      404,
      "provider_config_not_found"
    );
  }

  if (!config.apiKey) {
    throw buildProviderConfigError(
      "Configuracao AbacatePay sem API key descriptografada.",
      500,
      "provider_config_api_key_missing"
    );
  }

  return config;
}

export async function getActivePaymentProviderConfigByOrganization(
  organizationId,
  provider = DEFAULT_PROVIDER
) {
  return fetchDecryptedProviderConfig({
    organizationId,
    provider,
    activeOnly: true,
  });
}

export async function getActivePayoutProviderConfigByOrganization(
  organizationId,
  provider = DEFAULT_PROVIDER
) {
  return getActivePaymentProviderConfigByOrganization(organizationId, provider);
}

export async function getPaymentProviderConfigById(configId, provider = DEFAULT_PROVIDER) {
  return fetchDecryptedProviderConfig({
    configId,
    provider,
    activeOnly: false,
  });
}

export function buildPaymentProviderConfigSnapshot(config = {}) {
  if (!config?.id) return {};

  return {
    id: config.id,
    organizationId: config.organizationId || null,
    provider: normalizeProvider(config.provider),
    environment: config.environment || null,
    providerAccountId: config.providerAccountId || null,
    providerAccountName: config.providerAccountName || null,
    isActiveAtUse: config.isActive !== false,
    metadata: config.metadata && typeof config.metadata === "object" ? config.metadata : {},
    capturedAt: new Date().toISOString(),
  };
}

