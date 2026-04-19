function buildValidationError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

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

  return issues;
}

export function createPrecheckAuthDto(payload) {
  const email = normalizeEmail(payload?.email);

  if (!email || !isValidEmail(email)) {
    throw buildValidationError("Email inválido");
  }

  return { email };
}

export function createRegisterAuthDto(payload) {
  const email = normalizeEmail(payload?.email);
  const password = String(payload?.password || "");
  const passwordIssues = validatePassword(password);

  if (!email || !isValidEmail(email)) {
    throw buildValidationError("Email inválido");
  }

  if (passwordIssues.length > 0) {
    throw buildValidationError(`Senha inválida: ${passwordIssues.join(", ")}`);
  }

  return { email, password };
}

export function createLoginAuthDto(payload) {
  const email = normalizeEmail(payload?.email);
  const password = String(payload?.password || "");

  if (!email || !isValidEmail(email)) {
    throw buildValidationError("Email inválido");
  }

  if (!password) {
    throw buildValidationError("Informe sua senha");
  }

  return { email, password };
}

export function createForgotPasswordAuthDto(payload) {
  const email = normalizeEmail(payload?.email);

  if (!email || !isValidEmail(email)) {
    throw buildValidationError("Email inválido");
  }

  return { email };
}

export function createResetPasswordAuthDto(payload, authContext) {
  const email = normalizeEmail(payload?.email);
  const newPassword = String(payload?.newPassword || "");
  const confirmPassword = String(payload?.confirmPassword || "");
  const passwordIssues = validatePassword(newPassword);
  const accessToken = String(authContext?.accessToken || "");
  const refreshToken = String(authContext?.refreshToken || "");

  if (!accessToken || !refreshToken) {
    throw buildValidationError("Sessão de recuperação inválida ou expirada", 401);
  }

  if (!email || !isValidEmail(email)) {
    throw buildValidationError("Email inválido");
  }

  if (passwordIssues.length > 0) {
    throw buildValidationError(`Senha inválida: ${passwordIssues.join(", ")}`);
  }

  if (!confirmPassword || confirmPassword !== newPassword) {
    throw buildValidationError("As senhas não coincidem");
  }

  return {
    email,
    newPassword,
    confirmPassword,
    accessToken,
    refreshToken,
  };
}

export { buildValidationError };
