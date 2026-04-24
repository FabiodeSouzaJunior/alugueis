import {
  createTenantIdDto,
  createTenantListDto,
  createTenantWriteDto,
} from "../dto/tenant.dto";
import { getActiveGatewayProviderSummaryByOrganization } from "@/features/pagamentos/provider-configs";
import { PAYMENT_PROVIDER_ASAAS } from "@/server/modules/financial/payment-provider-gateway.service";
import {
  createTenantItem,
  deleteTenantItem,
  getTenantItem,
  listTenantItems,
  updateTenantItem,
} from "../service/tenant.service";

function buildResponse(status, body) {
  return { status, body };
}

function mapError(error, fallbackMessage) {
  return buildResponse(error?.status || 500, {
    error: error?.message || fallbackMessage,
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}

async function resolveTenantDtoOptions(auth = {}) {
  const organizationId = auth?.organizationId || null;
  if (!organizationId) {
    return { requiresAsaasTenantFields: false };
  }

  const activeProvider = await getActiveGatewayProviderSummaryByOrganization(organizationId).catch(
    () => null
  );

  return {
    requiresAsaasTenantFields: activeProvider?.provider === PAYMENT_PROVIDER_ASAAS,
  };
}

export async function handleListTenants(request) {
  try {
    const filters = createTenantListDto(new URL(request.url).searchParams);
    const items = await listTenantItems(filters, request.auth || {});
    return buildResponse(200, items);
  } catch (error) {
    return mapError(error, "Erro ao carregar inquilinos.");
  }
}

export async function handleGetTenant(_request, tenantId) {
  try {
    const id = createTenantIdDto(tenantId);
    const tenant = await getTenantItem(id, _request.auth || {});

    if (!tenant) {
      return buildResponse(404, { error: "Inquilino nao encontrado." });
    }

    return buildResponse(200, tenant);
  } catch (error) {
    return mapError(error, "Erro ao carregar inquilino.");
  }
}

export async function handleCreateTenant(request) {
  try {
    const payload = await readJson(request);
    const dto = createTenantWriteDto(payload, await resolveTenantDtoOptions(request.auth || {}));
    const createdTenant = await createTenantItem({
      ...dto,
      id: payload?.id,
    }, request.auth || {});
    return buildResponse(200, createdTenant);
  } catch (error) {
    return mapError(error, "Erro ao criar inquilino.");
  }
}

export async function handleUpdateTenant(request, tenantId) {
  try {
    const id = createTenantIdDto(tenantId);
    const payload = await readJson(request);
    const dto = createTenantWriteDto(payload, await resolveTenantDtoOptions(request.auth || {}));
    const updatedTenant = await updateTenantItem(id, dto, request.auth || {});
    return buildResponse(200, updatedTenant);
  } catch (error) {
    return mapError(error, "Erro ao atualizar inquilino.");
  }
}

export async function handleDeleteTenant(_request, tenantId) {
  try {
    const id = createTenantIdDto(tenantId);
    const result = await deleteTenantItem(id, _request.auth || {});
    return buildResponse(200, result);
  } catch (error) {
    return mapError(error, "Erro ao excluir inquilino.");
  }
}

