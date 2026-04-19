import { buildValidationError } from "../dto/auth.dto";
import {
  checkUserExistsByEmail,
  createUser,
  ensureOwnerAccessForUser,
  isUserAlreadyExistsError,
  resolveOrganizationIdByEmail,
  resolveRecoverySession,
  sendPasswordResetEmail,
  signInWithPassword,
  updatePasswordWithRecoverySession,
  upsertMembership,
} from "../repository/auth.repository";

function buildPasswordResetRedirect(origin) {
  const redirectUrl = new URL("/reset-password", origin);
  return redirectUrl.toString();
}

function mapSessionPayload(authResult) {
  const session = authResult?.data?.session;
  const user = authResult?.data?.user;

  if (!session) {
    throw buildValidationError("Sessão não gerada. Verifique configurações do Supabase.", 500);
  }

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    token_type: session.token_type,
    user_id: user?.id || null,
  };
}

export async function precheckEmail({ email }) {
  const organizationId = await resolveOrganizationIdByEmail(email);
  const hasAccount = organizationId ? await checkUserExistsByEmail(email) : false;

  return {
    allowed: !!organizationId,
    organizationId,
    hasAccount,
  };
}

export async function registerUser({ email, password }) {
  const organizationId = await resolveOrganizationIdByEmail(email);

  if (!organizationId) {
    throw buildValidationError("Email não registrado", 403);
  }

  const createUserResult = await createUser(email, password);

  if (createUserResult.error && !isUserAlreadyExistsError(createUserResult.error)) {
    throw buildValidationError(createUserResult.error.message, 400);
  }

  let userId = createUserResult.data?.user?.id || null;
  let signInResult = null;

  if (!userId && isUserAlreadyExistsError(createUserResult.error)) {
    signInResult = await signInWithPassword(email, password);

    if (signInResult.error || !signInResult.data?.user?.id) {
      throw buildValidationError(
        "Usuário já existe. Use a aba Entrar ou confirme a senha informada.",
        400
      );
    }

    userId = signInResult.data.user.id;
  }

  if (!userId) {
    throw buildValidationError("Falha ao criar usuário", 500);
  }

  const membershipResult = await upsertMembership(userId, organizationId);

  if (membershipResult.error) {
    throw buildValidationError(membershipResult.error.message, 500);
  }

  const ownerAccessResult = await ensureOwnerAccessForUser({
    userId,
    organizationId,
    email,
  });

  if (ownerAccessResult.error) {
    throw buildValidationError(ownerAccessResult.error.message, 500);
  }

  if (!signInResult) {
    signInResult = await signInWithPassword(email, password);
  }

  if (signInResult.error) {
    throw buildValidationError(
      signInResult.error.message || "Falha ao criar sessão após signup",
      500
    );
  }

  return {
    allowed: true,
    error: "",
    organization_id: organizationId,
    ...mapSessionPayload(signInResult),
  };
}

export async function loginUser({ email, password }) {
  const signInResult = await signInWithPassword(email, password);

  if (signInResult.error) {
    throw buildValidationError(signInResult.error.message || "Falha ao entrar", 400);
  }

  const userId = signInResult.data?.user?.id || null;
  const organizationId = await resolveOrganizationIdByEmail(email);

  if (userId && organizationId) {
    const membershipResult = await upsertMembership(userId, organizationId);
    if (membershipResult.error) {
      throw buildValidationError(membershipResult.error.message, 500);
    }

    const ownerAccessResult = await ensureOwnerAccessForUser({
      userId,
      organizationId,
      email,
    });

    if (ownerAccessResult.error) {
      throw buildValidationError(ownerAccessResult.error.message, 500);
    }
  }

  return {
    error: "",
    organization_id: organizationId,
    ...mapSessionPayload(signInResult),
  };
}

export async function forgotPassword({ email, origin }) {
  const redirectTo = buildPasswordResetRedirect(origin);
  const resetResult = await sendPasswordResetEmail(email, redirectTo);

  if (resetResult.error) {
    throw buildValidationError(
      resetResult.error.message || "Falha ao enviar email de recuperação",
      500
    );
  }

  return {
    success: true,
    error: "",
    message: "Se o email estiver cadastrado, você receberá um link de recuperação.",
    redirect_to: redirectTo,
  };
}

export async function resetPassword({
  email,
  newPassword,
  accessToken,
  refreshToken,
}) {
  const recoverySession = await resolveRecoverySession(accessToken, refreshToken);

  if (recoverySession.error || !recoverySession.user?.email) {
    throw buildValidationError("Sessão de recuperação inválida ou expirada", 401);
  }

  if (String(recoverySession.user.email).toLowerCase() !== email) {
    throw buildValidationError("O email informado não corresponde ao link de recuperação", 403);
  }

  const updateResult = await updatePasswordWithRecoverySession(
    accessToken,
    refreshToken,
    newPassword
  );

  if (updateResult.error) {
    throw buildValidationError(updateResult.error.message || "Falha ao redefinir senha", 400);
  }

  return {
    success: true,
    error: "",
    message: "Senha redefinida com sucesso.",
  };
}
