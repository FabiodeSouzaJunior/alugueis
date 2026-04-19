import {
  buildValidationError,
  isValidEmail,
  normalizeEmail,
} from "@/server/modules/auth/dto/auth.dto";
import {
  DEFAULT_TENANT_PAYMENT_DAY,
  isValidPaymentDay,
  normalizePaymentDay,
} from "@/lib/payment-dates";

const TENANT_STATUS_VALUES = new Set(["ativo", "saiu"]);

function normalizeNullableString(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidPhone(phone) {
  const digits = digitsOnly(phone);
  return digits.length === 10 || digits.length === 11;
}

function isValidCpf(cpf) {
  const normalized = digitsOnly(cpf);
  if (normalized.length !== 11 || /^(\d)\1+$/.test(normalized)) return false;

  let sum = 0;
  for (let idx = 0; idx < 9; idx += 1) {
    sum += Number(normalized[idx]) * (10 - idx);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number(normalized[9])) return false;

  sum = 0;
  for (let idx = 0; idx < 10; idx += 1) {
    sum += Number(normalized[idx]) * (11 - idx);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === Number(normalized[10]);
}

function isValidDocumentNumber(documentNumber) {
  const rawValue = String(documentNumber || "").trim();
  if (!rawValue) return false;

  const digits = digitsOnly(rawValue);
  if (digits.length === 11) {
    return isValidCpf(digits);
  }

  return rawValue.length >= 5;
}

function normalizeCurrency(value) {
  if (value == null || value === "") return 0;
  const normalized = Number(value);
  if (Number.isNaN(normalized) || !Number.isFinite(normalized)) {
    throw buildValidationError("Valor do aluguel invalido.");
  }
  return normalized;
}

function normalizeBoolean(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function normalizeDate(value, fieldLabel, { required = false } = {}) {
  const normalized = normalizeNullableString(value);
  if (!normalized) {
    if (required) {
      throw buildValidationError(`${fieldLabel} e obrigatorio.`);
    }
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw buildValidationError(`${fieldLabel} invalido.`);
  }

  const parsedDate = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    throw buildValidationError(`${fieldLabel} invalido.`);
  }

  return normalized;
}

export function createTenantWriteDto(payload = {}) {
  const name = normalizeNullableString(payload?.name);
  const phone = normalizeNullableString(payload?.phone);
  const documentNumber = normalizeNullableString(
    payload?.documentNumber ?? payload?.document_number
  );
  const address = normalizeNullableString(payload?.address);
  const birthDate = normalizeDate(payload?.birthDate ?? payload?.birth_date, "Data de nascimento");
  const email = normalizeEmail(payload?.email);
  const isPaymentResponsible = normalizeBoolean(
    payload?.isPaymentResponsible ?? payload?.is_payment_responsible
  );
  const kitnetNumber = normalizeNullableString(
    payload?.kitnetNumber ?? payload?.kitnet_number
  );
  const rentValue = normalizeCurrency(payload?.rentValue);
  const startDate = normalizeDate(
    payload?.startDate ?? payload?.start_date,
    "Data de entrada"
  );
  const rawPaymentDay = payload?.paymentDay ?? payload?.payment_day;
  const hasExplicitPaymentDay =
    rawPaymentDay != null && String(rawPaymentDay).trim() !== "";
  const paymentDay = hasExplicitPaymentDay
    ? normalizePaymentDay(rawPaymentDay)
    : DEFAULT_TENANT_PAYMENT_DAY;
  const status = normalizeNullableString(payload?.status) || "ativo";
  const observacao = normalizeNullableString(payload?.observacao);
  const propertyId = normalizeNullableString(payload?.propertyId ?? payload?.property_id);
  const unitId = normalizeNullableString(payload?.unitId ?? payload?.unit_id);
  const organizationId = normalizeNullableString(
    payload?.organizationId ?? payload?.organization_id
  );
  const iptuValue = normalizeCurrency(payload?.iptuValue ?? payload?.iptu_value ?? 0);
  const iptuAddToRent = normalizeBoolean(
    payload?.iptuAddToRent ?? payload?.iptu_add_to_rent
  );
  const rawIptuInstallments = Number(payload?.iptuInstallments ?? payload?.iptu_installments ?? 12);
  const iptuInstallments = Number.isFinite(rawIptuInstallments) && rawIptuInstallments >= 1 && rawIptuInstallments <= 12
    ? rawIptuInstallments
    : 12;

  if (!name) {
    throw buildValidationError("Nome completo e obrigatorio.");
  }

  if (isPaymentResponsible && !phone) {
    throw buildValidationError("Telefone e obrigatorio para o responsavel pelo pagamento.");
  }
  if (phone && !isValidPhone(phone)) {
    throw buildValidationError("Informe um telefone valido com DDD.");
  }

  if (documentNumber && !isValidDocumentNumber(documentNumber)) {
    throw buildValidationError("Informe um CPF ou documento valido.");
  }

  if (birthDate && new Date(`${birthDate}T00:00:00`).getTime() > Date.now()) {
    throw buildValidationError("Data de nascimento nao pode estar no futuro.");
  }

  if (!TENANT_STATUS_VALUES.has(status)) {
    throw buildValidationError("Status invalido.");
  }

  if (hasExplicitPaymentDay && !isValidPaymentDay(rawPaymentDay)) {
    throw buildValidationError("Dia do pagamento deve estar entre 1 e 31.");
  }

  if (email && !isValidEmail(email)) {
    throw buildValidationError("Informe um email valido.");
  }

  if (isPaymentResponsible && !email) {
    throw buildValidationError("Email e obrigatorio para o responsavel pelo pagamento.");
  }

  if (isPaymentResponsible && !propertyId) {
    throw buildValidationError("Selecione o imovel do responsavel pelo pagamento.");
  }

  return {
    name,
    phone,
    documentNumber,
    address,
    birthDate,
    email: email || null,
    isPaymentResponsible,
    kitnetNumber,
    rentValue,
    startDate,
    paymentDay,
    status,
    observacao,
    propertyId,
    unitId,
    organizationId,
    iptuValue,
    iptuAddToRent,
    iptuInstallments,
  };
}

export function createTenantListDto(searchParams) {
  return {
    propertyId: normalizeNullableString(searchParams?.get("propertyId")),
    financialOnly: normalizeBoolean(searchParams?.get("financialOnly")),
  };
}

export function createTenantIdDto(id) {
  const normalizedId = normalizeNullableString(id);
  if (!normalizedId) {
    throw buildValidationError("Id do inquilino e obrigatorio.", 400);
  }
  return normalizedId;
}

export { buildValidationError };
