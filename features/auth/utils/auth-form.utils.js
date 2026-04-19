export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password) {
  const issues = [];
  const value = String(password || "");

  if (value.length < 8) issues.push("mínimo 8 caracteres");
  if (!/[A-Z]/.test(value)) issues.push("1 letra maiúscula");
  if (!/\d/.test(value)) issues.push("1 número");

  return {
    valid: issues.length === 0,
    issues,
  };
}
