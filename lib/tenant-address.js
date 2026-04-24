function normalizeNullableString(value) {
  const normalized = String(value ?? "").trim();
  return normalized || "";
}

export function normalizeZipCode(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function buildStructuredTenantAddress({
  street = "",
  number = "",
  district = "",
  zipCode = "",
} = {}) {
  const normalizedStreet = normalizeNullableString(street);
  const normalizedNumber = normalizeNullableString(number);
  const normalizedDistrict = normalizeNullableString(district);
  const normalizedZipCode = normalizeZipCode(zipCode);

  if (!normalizedStreet && !normalizedNumber && !normalizedDistrict && !normalizedZipCode) {
    return "";
  }

  const parts = [];

  if (normalizedStreet && normalizedNumber) {
    parts.push(`${normalizedStreet}, ${normalizedNumber}`);
  } else if (normalizedStreet) {
    parts.push(normalizedStreet);
  } else if (normalizedNumber) {
    parts.push(normalizedNumber);
  }

  if (normalizedDistrict) {
    parts.push(normalizedDistrict);
  }

  if (normalizedZipCode) {
    parts.push(`CEP ${normalizedZipCode}`);
  }

  return parts.join(" - ");
}

export function parseStructuredTenantAddress(address) {
  const normalizedAddress = normalizeNullableString(address);
  if (!normalizedAddress) {
    return {
      street: "",
      number: "",
      district: "",
      zipCode: "",
    };
  }

  const match = normalizedAddress.match(
    /^(.*?)(?:,\s*([^,-]+))?(?:\s*-\s*([^,-]+))?(?:\s*-\s*CEP\s*([\d.-]+))?$/i
  );

  if (!match) {
    return {
      street: normalizedAddress,
      number: "",
      district: "",
      zipCode: "",
    };
  }

  const [, street = "", number = "", district = "", zipCode = ""] = match;

  return {
    street: normalizeNullableString(street),
    number: normalizeNullableString(number),
    district: normalizeNullableString(district),
    zipCode: normalizeZipCode(zipCode),
  };
}
