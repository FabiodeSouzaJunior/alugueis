import { getServiceRoleClient } from "@/database/supabaseClient";
import {
  PAYMENT_PROVIDER_ABACATEPAY,
  PAYMENT_PROVIDER_ASAAS,
  SUPPORTED_PAYMENT_PROVIDERS,
  getPaymentProviderLabel,
  normalizePaymentProvider,
} from "@/server/modules/financial/payment-provider-gateway.service";

const MIN_ENCRYPTION_KEY_LENGTH = 32;
const DEFAULT_PROVIDER = PAYMENT_PROVIDER_ABACATEPAY;

export function normalizeProvider(provider) {
  return normalizePaymentProvider(provider);
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

function assertSupportedProvider(provider) {
  const normalizedProvider = normalizeProvider(provider);
  if (!SUPPORTED_PAYMENT_PROVIDERS.includes(normalizedProvider)) {
    throw buildProviderConfigError("Provider de pagamento nao suportado.", 400, "provider_invalid");
  }
  return normalizedProvider;
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

function mapProviderConfigSafeRow(row = {}) {
  const provider = normalizeProvider(row.provider);
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};

  return {
    id: row.id,
    organizationId: row.organization_id,
    provider,
    providerLabel: getPaymentProviderLabel(provider),
    isActive: row.is_active !== false,
    environment: normalizeNullableString(row.environment) || "production",
    apiKeyConfigured: !!row.api_key_encrypted,
    webhookSecretConfigured: !!row.webhook_secret_encrypted,
    webhookPublicKeyConfigured: !!row.webhook_public_key_encrypted,
    providerAccountName: normalizeNullableString(row.provider_account_name),
    providerAccountId: normalizeNullableString(row.provider_account_id),
    metadata,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function fetchActiveProviderConfigRowByOrganization(organizationId) {
  const normalizedOrganizationId = normalizeNullableString(organizationId);
  if (!normalizedOrganizationId) {
    throw buildProviderConfigError(
      "Informe a organizacao para localizar o provider ativo.",
      400,
      "provider_config_scope_missing"
    );
  }

  const serviceClient = getServiceRoleClient();
  const { data, error } = await serviceClient
    .from("organization_payment_provider_configs")
    .select(
      "id, organization_id, provider, is_active, environment, provider_account_name, provider_account_id, metadata, created_at, updated_at"
    )
    .eq("organization_id", normalizedOrganizationId)
    .eq("is_active", true)
    .in("provider", SUPPORTED_PAYMENT_PROVIDERS)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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

  return data || null;
}

async function fetchProviderConfigProviderById(configId) {
  const normalizedConfigId = normalizeNullableString(configId);
  if (!normalizedConfigId) return null;

  const serviceClient = getServiceRoleClient();
  const { data, error } = await serviceClient
    .from("organization_payment_provider_configs")
    .select("provider")
    .eq("id", normalizedConfigId)
    .maybeSingle();

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

  return data?.provider ? normalizeProvider(data.provider) : null;
}

async function fetchDecryptedProviderConfig({
  configId = null,
  organizationId = null,
  provider = DEFAULT_PROVIDER,
  activeOnly = false,
} = {}) {
  let normalizedProvider = provider == null ? null : assertSupportedProvider(provider);
  const normalizedConfigId = normalizeNullableString(configId);
  const normalizedOrganizationId = normalizeNullableString(organizationId);

  if (!normalizedConfigId && !normalizedOrganizationId) {
    throw buildProviderConfigError(
      "Informe a organizacao ou o id da configuracao do provider.",
      400,
      "provider_config_scope_missing"
    );
  }

  if (!normalizedProvider && normalizedConfigId) {
    normalizedProvider = await fetchProviderConfigProviderById(normalizedConfigId);
  }

  if (!normalizedProvider && normalizedOrganizationId && activeOnly) {
    const activeRow = await fetchActiveProviderConfigRowByOrganization(normalizedOrganizationId);
    normalizedProvider = activeRow?.provider ? normalizeProvider(activeRow.provider) : null;
  }

  if (!normalizedProvider) {
    normalizedProvider = DEFAULT_PROVIDER;
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
    const providerLabel = getPaymentProviderLabel(normalizedProvider);
    throw buildProviderConfigError(
      activeOnly
        ? `Configuracao ${providerLabel} ativa nao encontrada para a organizacao.`
        : `Configuracao ${providerLabel} vinculada ao registro nao encontrada.`,
      404,
      "provider_config_not_found"
    );
  }

  if (!config.apiKey) {
    const providerLabel = getPaymentProviderLabel(config.provider);
    throw buildProviderConfigError(
      `Configuracao ${providerLabel} sem API key descriptografada.`,
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

export async function getActiveGatewayProviderConfigByOrganization(organizationId) {
  return fetchDecryptedProviderConfig({
    organizationId,
    provider: null,
    activeOnly: true,
  });
}

export async function getActiveGatewayProviderSummaryByOrganization(organizationId) {
  const row = await fetchActiveProviderConfigRowByOrganization(organizationId);
  return row ? mapProviderConfigSafeRow(row) : null;
}

export async function getActivePayoutProviderConfigByOrganization(
  organizationId,
  provider = DEFAULT_PROVIDER
) {
  if (provider == null) {
    return getActiveGatewayProviderConfigByOrganization(organizationId);
  }

  return getActivePaymentProviderConfigByOrganization(organizationId, provider);
}

export async function getPaymentProviderConfigById(configId, provider = DEFAULT_PROVIDER) {
  return fetchDecryptedProviderConfig({
    configId,
    provider,
    activeOnly: false,
  });
}

async function encryptProviderSecret(serviceClient, secret) {
  const normalizedSecret = normalizeNullableString(secret);
  if (!normalizedSecret) return null;

  const { data, error } = await serviceClient.rpc("encrypt_payment_provider_secret", {
    p_secret: normalizedSecret,
    p_encryption_key: getProviderConfigEncryptionKey(),
  });

  if (error) {
    if (providerConfigStoreUnavailable(error)) {
      throw buildProviderConfigError(
        "RPC de criptografia de provider de pagamento nao encontrada.",
        500,
        "provider_config_store_missing"
      );
    }
    throw error;
  }

  return data || null;
}

export async function listPaymentProviderConfigsByOrganization(organizationId) {
  const normalizedOrganizationId = normalizeNullableString(organizationId);
  if (!normalizedOrganizationId) {
    throw buildProviderConfigError(
      "Informe a organizacao para listar configuracoes de provider.",
      400,
      "provider_config_scope_missing"
    );
  }

  const serviceClient = getServiceRoleClient();
  const { data, error } = await serviceClient
    .from("organization_payment_provider_configs")
    .select(
      "id, organization_id, provider, is_active, environment, api_key_encrypted, webhook_secret_encrypted, webhook_public_key_encrypted, provider_account_name, provider_account_id, metadata, created_at, updated_at"
    )
    .eq("organization_id", normalizedOrganizationId)
    .in("provider", SUPPORTED_PAYMENT_PROVIDERS)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false });

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

  return (data || []).map(mapProviderConfigSafeRow);
}

export async function createPaymentProviderConfig({
  organizationId,
  provider,
  isActive = true,
  environment = "production",
  apiKey,
  webhookSecret = null,
  webhookPublicKey = null,
  providerAccountName = null,
  providerAccountId = null,
  metadata = {},
} = {}) {
  const normalizedOrganizationId = normalizeNullableString(organizationId);
  if (!normalizedOrganizationId) {
    throw buildProviderConfigError(
      "Informe a organizacao da configuracao do provider.",
      400,
      "provider_config_scope_missing"
    );
  }

  const normalizedProvider = assertSupportedProvider(provider);
  const normalizedApiKey = normalizeNullableString(apiKey);
  if (!normalizedApiKey) {
    throw buildProviderConfigError(
      `Informe a API key ${getPaymentProviderLabel(normalizedProvider)}.`,
      400,
      "provider_config_api_key_missing"
    );
  }

  const normalizedMetadata = metadata && typeof metadata === "object" ? metadata : {};
  const serviceClient = getServiceRoleClient();
  const shouldActivate = isActive !== false;

  if (shouldActivate) {
    const { error: deactivateError } = await serviceClient
      .from("organization_payment_provider_configs")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", normalizedOrganizationId)
      .in("provider", SUPPORTED_PAYMENT_PROVIDERS)
      .eq("is_active", true);

    if (deactivateError) throw deactivateError;
  }

  const [encryptedApiKey, encryptedWebhookSecret, encryptedWebhookPublicKey] =
    await Promise.all([
      encryptProviderSecret(serviceClient, normalizedApiKey),
      encryptProviderSecret(serviceClient, webhookSecret),
      encryptProviderSecret(serviceClient, webhookPublicKey),
    ]);

  const { data, error } = await serviceClient
    .from("organization_payment_provider_configs")
    .insert({
      organization_id: normalizedOrganizationId,
      provider: normalizedProvider,
      is_active: shouldActivate,
      environment: normalizeNullableString(environment) || "production",
      api_key_encrypted: encryptedApiKey,
      webhook_secret_encrypted: encryptedWebhookSecret,
      webhook_public_key_encrypted: encryptedWebhookPublicKey,
      provider_account_name: normalizeNullableString(providerAccountName),
      provider_account_id: normalizeNullableString(providerAccountId),
      metadata: {
        ...normalizedMetadata,
        createdVia: normalizedMetadata.createdVia || "admin_api",
      },
    })
    .select(
      "id, organization_id, provider, is_active, environment, api_key_encrypted, webhook_secret_encrypted, webhook_public_key_encrypted, provider_account_name, provider_account_id, metadata, created_at, updated_at"
    )
    .maybeSingle();

  if (error) throw error;
  return mapProviderConfigSafeRow(data || {});
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

