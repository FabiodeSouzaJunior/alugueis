import {
  DEFAULT_TENANT_PAYMENT_DAY,
  isValidPaymentDay,
  normalizePaymentDay,
} from "@/lib/payment-dates";
import {
  buildStructuredTenantAddress,
  normalizeZipCode,
  parseStructuredTenantAddress,
} from "@/lib/tenant-address";

const TENANT_STATUS_VALUES = ["ativo", "saiu"];

export const defaultTenantFormValues = {
  name: "",
  phone: "",
  documentNumber: "",
  addressStreet: "",
  addressNumber: "",
  addressDistrict: "",
  addressZipCode: "",
  email: "",
  isPaymentResponsible: false,
  kitnetNumber: "",
  rentValue: "",
  startDate: "",
  paymentDay: String(DEFAULT_TENANT_PAYMENT_DAY),
  status: "ativo",
  observacao: "",
  propertyId: "",
  unitId: "",
  iptuValue: "",
  iptuAddToRent: false,
  iptuInstallments: "12",
};

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeNullableString(value) {
  const normalized = String(value ?? "").trim();
  return normalized || "";
}

export function normalizeTenantEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isValidTenantEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export function isValidTenantPhone(phone) {
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

export function isValidTenantDocument(documentNumber) {
  const rawValue = normalizeNullableString(documentNumber);
  if (!rawValue) return false;

  const digits = digitsOnly(rawValue);
  if (digits.length === 11) {
    return isValidCpf(digits);
  }

  return rawValue.length >= 5;
}

export function createTenantFormValues(tenant, initialValues = {}) {
  const structuredAddress = parseStructuredTenantAddress(tenant?.address || "");
  const tenantAddressStreet =
    tenant?.addressStreet ?? tenant?.address_street ?? structuredAddress.street;
  const tenantAddressNumber =
    tenant?.addressNumber ?? tenant?.address_number ?? structuredAddress.number;
  const tenantAddressDistrict =
    tenant?.addressDistrict ??
    tenant?.addressNeighborhood ??
    tenant?.address_district ??
    tenant?.address_neighborhood ??
    structuredAddress.district;
  const tenantAddressZipCode =
    tenant?.addressZipCode ?? tenant?.address_zip_code ?? structuredAddress.zipCode;
  const currentPropertyId = tenant?.propertyId ?? tenant?.property_id ?? "";
  const currentResponsible =
    typeof tenant?.isPaymentResponsible === "boolean"
      ? tenant.isPaymentResponsible
      : tenant?.is_payment_responsible === true ||
        tenant?.is_payment_responsible === 1 ||
        tenant?.is_payment_responsible === "1" ||
        tenant?.is_payment_responsible === "true" ||
        tenant?.is_payment_responsible === "t";

  const values = {
    ...defaultTenantFormValues,
    name: tenant?.name || "",
    phone: tenant?.phone || "",
    documentNumber: tenant?.documentNumber || tenant?.document_number || "",
    addressStreet: tenantAddressStreet,
    addressNumber: tenantAddressNumber,
    addressDistrict: tenantAddressDistrict,
    addressZipCode: tenantAddressZipCode,
    email: tenant?.email || "",
    isPaymentResponsible: currentResponsible,
    kitnetNumber: String(tenant?.kitnetNumber ?? tenant?.kitnet_number ?? ""),
    rentValue: (() => {
      if (tenant?.rentValue == null) return "";
      let stored = Number(tenant.rentValue);
      // Subtrair o IPTU mensal para exibir apenas o valor base do aluguel
      const iptu = tenant?.iptuValue != null ? Number(tenant.iptuValue) : 0;
      if (iptu > 0) {
        const installments = Math.max(1, Math.min(12, Number(tenant?.iptuInstallments ?? tenant?.iptu_installments ?? 12)));
        stored = Math.max(0, stored - iptu / installments);
      }
      return stored.toFixed(2).replace(".", ",");
    })(),
    startDate: tenant?.startDate || tenant?.start_date || "",
    paymentDay: String(
      normalizePaymentDay(tenant?.paymentDay ?? tenant?.payment_day)
    ),
    status: tenant?.status || "ativo",
    observacao: tenant?.observacao || "",
    propertyId:
      currentPropertyId != null && String(currentPropertyId).trim() !== ""
        ? String(currentPropertyId).trim()
        : "",
    unitId:
      tenant?.unitId != null && String(tenant.unitId).trim() !== ""
        ? String(tenant.unitId).trim()
        : "",
    iptuValue:
      tenant?.iptuValue != null
        ? Number(tenant.iptuValue).toFixed(2).replace(".", ",")
        : "",
    iptuAddToRent: true,
    iptuInstallments:
      tenant?.iptuInstallments != null
        ? String(tenant.iptuInstallments)
        : tenant?.iptu_installments != null
          ? String(tenant.iptu_installments)
          : "12",
    ...initialValues,
  };

  return {
    ...values,
    paymentDay: String(normalizePaymentDay(values.paymentDay)),
    addressZipCode: normalizeZipCode(values.addressZipCode),
  };
}

export function validateTenantForm(form, options = {}) {
  const errors = {};
  const requiresAsaasTenantFields = options?.requiresAsaasTenantFields === true;

  if (!normalizeNullableString(form.name)) {
    errors.name = "Nome completo e obrigatorio.";
  }

  if (form.isPaymentResponsible && !normalizeNullableString(form.phone)) {
    errors.phone = "Telefone e obrigatorio para o responsavel pelo pagamento.";
  } else if (normalizeNullableString(form.phone) && !isValidTenantPhone(form.phone)) {
    errors.phone = "Informe um telefone valido com DDD.";
  }

  const normalizedDocument = normalizeNullableString(form.documentNumber);
  if (requiresAsaasTenantFields && !normalizedDocument) {
    errors.documentNumber = "CPF e obrigatorio quando o gateway ASAAS estiver ativo.";
  } else if (requiresAsaasTenantFields && !isValidCpf(normalizedDocument)) {
    errors.documentNumber = "Informe um CPF valido.";
  } else if (normalizedDocument && !isValidTenantDocument(normalizedDocument)) {
    errors.documentNumber = "Informe um CPF ou documento valido.";
  }

  const normalizedStreet = normalizeNullableString(form.addressStreet);
  const normalizedNumber = normalizeNullableString(form.addressNumber);
  const normalizedDistrict = normalizeNullableString(form.addressDistrict);
  const normalizedZipCode = normalizeZipCode(form.addressZipCode);

  if (requiresAsaasTenantFields && !normalizedStreet) {
    errors.addressStreet = "Logradouro e obrigatorio quando o gateway ASAAS estiver ativo.";
  }

  if (requiresAsaasTenantFields && !normalizedNumber) {
    errors.addressNumber = "Numero do endereco e obrigatorio quando o gateway ASAAS estiver ativo.";
  }

  if (requiresAsaasTenantFields && !normalizedDistrict) {
    errors.addressDistrict = "Bairro e obrigatorio quando o gateway ASAAS estiver ativo.";
  }

  if (requiresAsaasTenantFields && !normalizedZipCode) {
    errors.addressZipCode = "CEP e obrigatorio quando o gateway ASAAS estiver ativo.";
  } else if (normalizedZipCode && normalizedZipCode.replace(/\D/g, "").length !== 8) {
    errors.addressZipCode = "Informe um CEP valido com 8 digitos.";
  }

  if (!TENANT_STATUS_VALUES.includes(form.status)) {
    errors.status = "Status invalido.";
  }

  if (!isValidPaymentDay(form.paymentDay)) {
    errors.paymentDay = "Informe um dia do pagamento entre 1 e 31.";
  }

  const normalizedEmail = normalizeTenantEmail(form.email);
  if (form.isPaymentResponsible && !normalizedEmail) {
    errors.email = "Email e obrigatorio para o responsavel pelo pagamento.";
  } else if (normalizedEmail && !isValidTenantEmail(normalizedEmail)) {
    errors.email = "Informe um email valido.";
  }

  if (form.isPaymentResponsible && !normalizeNullableString(form.propertyId)) {
    errors.propertyId = "Selecione o imovel do responsavel pelo pagamento.";
  }

  return errors;
}

export function computeIptuMonthlyValue(form) {
  if (!form.isPaymentResponsible) return 0;
  const rawIptu = String(form.iptuValue || "").replace(/\D/g, "");
  const iptuTotal = rawIptu ? Number(rawIptu) / 100 : 0;
  if (iptuTotal <= 0) return 0;
  const installments = Math.max(1, Math.min(12, Number(form.iptuInstallments) || 12));
  return iptuTotal / installments;
}

export function buildTenantPayload(form) {
  const rawRent = form.isPaymentResponsible ? String(form.rentValue || "").replace(/\D/g, "") : "";
  const baseRent = rawRent ? Number(rawRent) / 100 : 0;
  const iptuMonthly = computeIptuMonthlyValue(form);
  const rentValue = baseRent + iptuMonthly;

  const rawIptu = form.isPaymentResponsible ? String(form.iptuValue || "").replace(/\D/g, "") : "";
  const iptuValue = rawIptu ? Number(rawIptu) / 100 : 0;
  const iptuInstallments = Math.max(1, Math.min(12, Number(form.iptuInstallments) || 12));

  return {
    name: normalizeNullableString(form.name),
    phone: normalizeNullableString(form.phone),
    documentNumber: normalizeNullableString(form.documentNumber),
    addressStreet: normalizeNullableString(form.addressStreet),
    addressNumber: normalizeNullableString(form.addressNumber),
    addressNeighborhood: normalizeNullableString(form.addressDistrict),
    addressDistrict: normalizeNullableString(form.addressDistrict),
    addressZipCode: normalizeZipCode(form.addressZipCode),
    address:
      buildStructuredTenantAddress({
        street: form.addressStreet,
        number: form.addressNumber,
        district: form.addressDistrict,
        zipCode: form.addressZipCode,
      }) || null,
    email: normalizeTenantEmail(form.email) || null,
    isPaymentResponsible: !!form.isPaymentResponsible,
    kitnetNumber: normalizeNullableString(form.kitnetNumber),
    rentValue,
    startDate: normalizeNullableString(form.startDate) || null,
    paymentDay: normalizePaymentDay(form.paymentDay),
    status: TENANT_STATUS_VALUES.includes(form.status) ? form.status : "ativo",
    observacao: normalizeNullableString(form.observacao) || null,
    propertyId: normalizeNullableString(form.propertyId) || null,
    unitId: normalizeNullableString(form.unitId) || null,
    iptuValue,
    iptuAddToRent: iptuValue > 0,
    iptuInstallments,
  };
}
