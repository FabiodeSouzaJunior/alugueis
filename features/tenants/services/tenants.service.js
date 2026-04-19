const BASE = "";

async function getAuthToken() {
  try {
    const { getBrowserSupabaseClient } = await import("@/lib/supabase-browser");
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

async function authHeaders(extra = {}) {
  const token = await getAuthToken();
  const headers = { ...extra };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw {
      name: "Error",
      message:
        typeof data?.error === "string"
          ? data.error
          : response.statusText || "Request failed",
    };
  }
  return data;
}

export async function fetchTenants(params = {}) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${BASE}/api/tenants${query ? `?${query}` : ""}`, {
    headers: await authHeaders(),
  });
  return handleResponse(response);
}

export async function createTenant(payload) {
  const response = await fetch(`${BASE}/api/tenants`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function updateTenant(id, payload) {
  const response = await fetch(`${BASE}/api/tenants/${id}`, {
    method: "PUT",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function deleteTenant(id) {
  const response = await fetch(`${BASE}/api/tenants/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  return handleResponse(response);
}

export async function fetchTenantPropertyUnits(propertyId) {
  const response = await fetch(`${BASE}/api/properties/${propertyId}/units`, {
    headers: await authHeaders(),
  });
  return handleResponse(response);
}

export async function generateTenantPayments(tenantId, rentValue, startDate) {
  const response = await fetch(`${BASE}/api/payments/generate`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ tenantId, rentValue, startDate }),
  });
  return handleResponse(response);
}

export async function uploadTenantContract(tenantId, file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BASE}/api/tenants/${tenantId}/contract`, {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
  });
  return handleResponse(response);
}

export async function deleteTenantContract(tenantId) {
  const response = await fetch(`${BASE}/api/tenants/${tenantId}/contract`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  return handleResponse(response);
}

export async function fetchTenantContract(tenantId) {
  const response = await fetch(`${BASE}/api/tenants/${tenantId}/contract`, {
    headers: await authHeaders(),
  });
  if (response.status === 404) return null;
  return handleResponse(response);
}
