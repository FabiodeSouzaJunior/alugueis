import { pool } from "@/database/db";
import { normalizePaymentDay } from "@/lib/payment-dates";

let __loggedDateToISOStringMismatch = false;

function formatDateOnly(value, fieldName) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10) || null;
  if (typeof value?.toISOString === "function") return value.toISOString().split("T")[0] || null;

  if (!__loggedDateToISOStringMismatch) {
    __loggedDateToISOStringMismatch = true;
    console.warn(`Unexpected date value in ${fieldName}.`);
  }

  return null;
}

function formatTimestamp(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value?.toISOString === "function") return value.toISOString();
  return null;
}

function rowToTenant(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? null,
    documentNumber: row.document_number ?? null,
    address: row.address ?? null,
    birthDate: formatDateOnly(row.birth_date, "birth_date"),
    email: row.email ?? null,
    isPaymentResponsible:
      typeof row.is_payment_responsible === "boolean"
        ? row.is_payment_responsible
        : row.is_payment_responsible === 1 ||
          row.is_payment_responsible === "1" ||
          row.is_payment_responsible === "true" ||
          row.is_payment_responsible === "t",
    kitnetNumber: row.kitnet_number ?? null,
    rentValue: Number(row.rent_value) ?? 0,
    startDate: formatDateOnly(row.start_date, "start_date"),
    paymentDay: normalizePaymentDay(row.payment_day ?? row.paymentDay),
    status: row.status ?? "ativo",
    observacao: row.observacao ?? null,
    propertyId: row.property_id ?? null,
    contractFilePath: row.contract_file_path ?? null,
    contractFileName: row.contract_file_name ?? null,
    contractMimeType: row.contract_mime_type ?? null,
    contractSizeBytes: row.contract_size_bytes ? Number(row.contract_size_bytes) : null,
    contractUploadedAt: row.contract_uploaded_at ?? null,
    iptuValue: row.iptu_value != null ? Number(row.iptu_value) : 0,
    iptuAddToRent:
      typeof row.iptu_add_to_rent === "boolean"
        ? row.iptu_add_to_rent
        : row.iptu_add_to_rent === 1 ||
          row.iptu_add_to_rent === "1" ||
          row.iptu_add_to_rent === "true" ||
          row.iptu_add_to_rent === "t" ||
          false,
    iptuInstallments: row.iptu_installments != null ? Number(row.iptu_installments) : 12,
    createdAt: formatTimestamp(row.created_at),
    updatedAt: formatTimestamp(row.updated_at),
  };
}

function rowToPayment(row) {
  if (!row) return null;
  const rawExpected = row.expected_amount;
  const expectedAmount =
    rawExpected != null &&
    rawExpected !== "" &&
    !isNaN(Number(rawExpected))
      ? Number(rawExpected)
      : null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    month: row.month,
    year: row.year,
    dueDate: formatDateOnly(row.due_date, "due_date"),
    paymentDate: formatDateOnly(row.payment_date, "payment_date"),
    amount: Number(row.amount) ?? 0,
    expectedAmount,
    status: row.status ?? "pendente",
    createdAt: formatTimestamp(row.created_at),
    updatedAt: formatTimestamp(row.updated_at),
  };
}

function rowToMaintenance(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    location: row.location ?? null,
    description: row.description ?? null,
    priority: row.priority ?? "media",
    status: row.status ?? "pendente",
    spentValue: row.spent_value != null ? Number(row.spent_value) : 0,
    createdAt: formatDateOnly(row.created_at, "created_at"),
    updatedAt: row.updated_at?.toISOString?.() ?? null,
  };
}

function rowToExpense(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    value: Number(row.value) ?? 0,
    date: formatDateOnly(row.date, "date"),
    description: row.description ?? null,
    createdAt: row.created_at?.toISOString?.() ?? null,
    updatedAt: row.updated_at?.toISOString?.() ?? null,
  };
}

function rowToObra(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name ?? "",
    propertyId: row.property_id ?? null,
    budget: Number(row.budget) ?? 0,
    startDate: formatDateOnly(row.start_date, "start_date"),
    endDate: formatDateOnly(row.end_date, "end_date"),
    areaM2: row.area_m2 != null ? Number(row.area_m2) : null,
    status: row.status ?? "ativa",
    createdAt: row.created_at?.toISOString?.() ?? null,
    updatedAt: row.updated_at?.toISOString?.() ?? null,
  };
}

function rowToObraCost(row) {
  if (!row) return null;
  return {
    id: row.id,
    obraId: row.obra_id,
    date: formatDateOnly(row.date, "date"),
    category: row.category ?? "Outros",
    description: row.description ?? null,
    value: Number(row.value) ?? 0,
    responsible: row.responsible ?? null,
    notes: row.notes ?? null,
    referenceType: row.reference_type ?? null,
    referenceId: row.reference_id ?? null,
    createdAt: row.created_at?.toISOString?.() ?? null,
    updatedAt: row.updated_at?.toISOString?.() ?? null,
  };
}

function rowToObraMaterial(row) {
  if (!row) return null;
  return {
    id: row.id,
    obraId: row.obra_id,
    materialName: row.material_name ?? "",
    quantity: Number(row.quantity) ?? 0,
    unit: row.unit ?? "un",
    unitPrice: Number(row.unit_price) ?? 0,
    totalValue: Number(row.total_value) ?? 0,
    supplier: row.supplier ?? null,
    purchaseDate: formatDateOnly(row.purchase_date, "purchase_date"),
    createdAt: row.created_at?.toISOString?.() ?? null,
    updatedAt: row.updated_at?.toISOString?.() ?? null,
  };
}

function rowToObraWorker(row) {
  if (!row) return null;
  return {
    id: row.id,
    obraId: row.obra_id,
    name: row.name ?? "",
    role: row.role ?? null,
    dailyRate: Number(row.daily_rate) ?? 0,
    daysWorked: Number(row.days_worked) ?? 0,
    totalPaid: Number(row.total_paid) ?? 0,
    phone: row.telefone ?? null,
    observacao: row.observacao ?? null,
    createdAt: row.created_at?.toISOString?.() ?? null,
    updatedAt: row.updated_at?.toISOString?.() ?? null,
  };
}

function rowToObraStage(row) {
  if (!row) return null;
  return {
    id: row.id,
    obraId: row.obra_id,
    name: row.name ?? "",
    status: row.status ?? "Pendente",
    startDate: formatDateOnly(row.start_date, "start_date"),
    dueDate: formatDateOnly(row.due_date, "due_date"),
    responsible: row.responsible ?? null,
    createdAt: row.created_at?.toISOString?.() ?? null,
    updatedAt: row.updated_at?.toISOString?.() ?? null,
  };
}

function rowToObraAgenda(row) {
  if (!row) return null;
  return {
    id: row.id,
    obraId: row.obra_id,
    date: formatDateOnly(row.date, "date"),
    activity: row.activity ?? "",
    responsible: row.responsible ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at?.toISOString?.() ?? null,
    updatedAt: row.updated_at?.toISOString?.() ?? null,
  };
}

function rowToObraStageWorker(row) {
  if (!row) return null;
  return {
    id: row.id,
    obraId: row.obra_id,
    stageId: row.stage_id,
    workerId: row.worker_id,
    createdAt: row.created_at?.toISOString?.() ?? null,
  };
}

function rowToNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type ?? null,
    title: row.title ?? null,
    message: row.message ?? null,
    relatedEntity: row.related_entity ?? null,
    relatedId: row.related_id ?? null,
    linkHref: row.link_href ?? null,
    readAt: row.read_at?.toISOString?.() ?? null,
    createdAt: row.created_at?.toISOString?.() ?? null,
  };
}

function rowToCondominiumBaseValue(row) {
  if (!row) return null;
  return {
    id: row.id,
    value: Number(row.value) ?? 0,
    startDate: row.start_date ? (row.start_date.toISOString ? row.start_date.toISOString().split("T")[0] : String(row.start_date)) : null,
  };
}

function rowToCondominiumExpense(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name ?? "",
    totalValue: Number(row.total_value) ?? 0,
    expenseDate: row.expense_date ? (row.expense_date.toISOString ? row.expense_date.toISOString().split("T")[0] : String(row.expense_date)) : null,
    numberOfUnits: Number(row.number_of_units) ?? 1,
    installments: Number(row.installments) ?? 1,
    startMonth: Number(row.start_month) ?? 1,
    startYear: Number(row.start_year) ?? new Date().getFullYear(),
  };
}

function rowToCondominiumSettings(row) {
  if (!row) return null;
  return {
    id: row.id,
    chargeWithRent:
      typeof row.charge_with_rent === "boolean"
        ? row.charge_with_rent
        : row.charge_with_rent === 0
          ? false
          : true,
    updatedAt: row.updated_at?.toISOString?.() ?? null,
  };
}

function rowToTenantExit(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id ?? null,
    exitDate: row.exit_date ? (row.exit_date.toISOString ? row.exit_date.toISOString().split("T")[0] : String(row.exit_date)) : null,
    reasonCode: row.reason_code ?? null,
    notes: row.notes ?? null,
  };
}

function rowToResidentEvaluation(row) {
  if (!row) return null;
  let categories = row.categories;
  if (typeof categories === "string") {
    try {
      categories = categories ? JSON.parse(categories) : [];
    } catch (_) {
      categories = [];
    }
  }
  if (!Array.isArray(categories)) categories = [];
  return {
    id: row.id,
    tenantName: row.tenant_name ?? null,
    contact: row.contact ?? null,
    kitnetNumber: row.kitnet_number ?? null,
    comfortRating: row.comfort_rating != null ? Number(row.comfort_rating) : null,
    cleanlinessRating: row.cleanliness_rating != null ? Number(row.cleanliness_rating) : null,
    infrastructureRating: row.infrastructure_rating != null ? Number(row.infrastructure_rating) : null,
    locationRating: row.location_rating != null ? Number(row.location_rating) : null,
    costBenefitRating: row.cost_benefit_rating != null ? Number(row.cost_benefit_rating) : null,
    overallRating: row.overall_rating != null ? Number(row.overall_rating) : null,
    recommendation: row.recommendation ?? null,
    comment: row.comment ?? null,
    categories,
    createdAt: row.created_at?.toISOString?.() ?? null,
  };
}

function rowToProperty(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name ?? "",
    unitCount: row.unit_count != null ? Number(row.unit_count) : 0,
    maxPeople: row.max_people != null ? Number(row.max_people) : 0,
    currentPeople: row.current_people != null ? Number(row.current_people) : 0,
    observacoes: row.observacoes ?? null,
    estimatedValue: row.estimated_value != null ? Number(row.estimated_value) : null,
    paymentResponsible: row.payment_responsible ?? null,
    createdAt: row.created_at?.toISOString?.() ?? null,
    updatedAt: row.updated_at?.toISOString?.() ?? null,
  };
}

function rowToPropertyUnit(row) {
  if (!row) return null;
  return {
    id: row.id,
    propertyId: row.property_id ?? null,
    rentPrice: row.rent_price != null ? Number(row.rent_price) : null,
    unitLabel: row.unit_label ?? null,
    maxPeople: row.max_people != null ? Number(row.max_people) : null,
    tenantId: row.tenant_id ?? null,
    residentTenantId: row.resident_tenant_id ?? null,
    createdAt: row.created_at?.toISOString?.() ?? null,
    updatedAt: row.updated_at?.toISOString?.() ?? null,
  };
}

function rowToWaterEnergyConsumption(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id ?? null,
    month: row.month,
    year: row.year,
    waterUsage: row.water_usage != null ? Number(row.water_usage) : 0,
    electricityUsage: row.electricity_usage != null ? Number(row.electricity_usage) : 0,
    addToRent:
      typeof row.add_to_rent === "boolean"
        ? row.add_to_rent
        : row.add_to_rent === 1 || row.add_to_rent === "1" || row.add_to_rent === "true",
    notes: row.notes ?? null,
    createdAt: row.created_at?.toISOString?.() ?? null,
    updatedAt: row.updated_at?.toISOString?.() ?? null,
  };
}

function rowToTenantFeedback(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id ?? null,
    category: row.category ?? null,
    comment: row.comment ?? null,
    createdAt: row.created_at?.toISOString?.() ?? null,
  };
}

function rowToTenantInteraction(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id ?? null,
    type: row.type ?? null,
    description: row.description ?? null,
    occurredAt: row.occurred_at?.toISOString?.() ?? row.occurred_at ?? null,
    createdAt: row.created_at?.toISOString?.() ?? null,
  };
}

function rowToTenantSatisfaction(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id ?? null,
    comfort: row.comfort != null ? Number(row.comfort) : null,
    cleanliness: row.cleanliness != null ? Number(row.cleanliness) : null,
    infrastructure: row.infrastructure != null ? Number(row.infrastructure) : null,
    location: row.location != null ? Number(row.location) : null,
    costBenefit: row.cost_benefit != null ? Number(row.cost_benefit) : null,
    overall: row.overall != null ? Number(row.overall) : null,
    createdAt: row.created_at?.toISOString?.() ?? null,
  };
}

export {
  pool,
  rowToTenant,
  rowToPayment,
  rowToMaintenance,
  rowToExpense,
  rowToObra,
  rowToObraCost,
  rowToObraMaterial,
  rowToObraWorker,
  rowToObraStage,
  rowToObraAgenda,
  rowToObraStageWorker,
  rowToNotification,
  rowToCondominiumBaseValue,
  rowToCondominiumExpense,
  rowToCondominiumSettings,
  rowToTenantExit,
  rowToResidentEvaluation,
  rowToProperty,
  rowToPropertyUnit,
  rowToWaterEnergyConsumption,
  rowToTenantFeedback,
  rowToTenantInteraction,
  rowToTenantSatisfaction,
};
