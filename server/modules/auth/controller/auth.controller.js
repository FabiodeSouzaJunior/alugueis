import {
  createForgotPasswordAuthDto,
  createLoginAuthDto,
  createPrecheckAuthDto,
  createRegisterAuthDto,
  createResetPasswordAuthDto,
} from "../dto/auth.dto";
import {
  forgotPassword,
  loginUser,
  precheckEmail,
  registerUser,
  resetPassword,
} from "../service/auth.service";

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

function readRecoveryAuthContext(request) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";

  return {
    accessToken,
    refreshToken: String(request.headers.get("x-refresh-token") || ""),
  };
}

export async function handlePrecheckAuth(request) {
  try {
    const payload = await readJson(request);
    const dto = createPrecheckAuthDto(payload);
    const result = await precheckEmail(dto);

    if (!result.allowed) {
      return buildResponse(200, {
        allowed: false,
        organization_id: null,
        error: "Email não registrado",
      });
    }

    return buildResponse(200, {
      allowed: true,
      organization_id: result.organizationId,
      has_account: result.hasAccount,
      error: "",
    });
  } catch (error) {
    return mapError(error, "Erro ao verificar email");
  }
}

export async function handleRegisterAuth(request) {
  try {
    const payload = await readJson(request);
    const dto = createRegisterAuthDto(payload);
    const result = await registerUser(dto);

    return buildResponse(200, result);
  } catch (error) {
    return buildResponse(error?.status || 500, {
      allowed: false,
      organization_id: null,
      error: error?.message || "Erro ao criar conta",
    });
  }
}

export async function handleLoginAuth(request) {
  try {
    const payload = await readJson(request);
    const dto = createLoginAuthDto(payload);
    const result = await loginUser(dto);

    return buildResponse(200, result);
  } catch (error) {
    return mapError(error, "Erro ao entrar");
  }
}

export async function handleForgotPasswordAuth(request) {
  try {
    const payload = await readJson(request);
    const dto = createForgotPasswordAuthDto(payload);
    const result = await forgotPassword({
      ...dto,
      origin: new URL(request.url).origin,
    });

    return buildResponse(200, result);
  } catch (error) {
    return mapError(error, "Erro ao enviar recuperação de senha");
  }
}

export async function handleResetPasswordAuth(request) {
  try {
    const payload = await readJson(request);
    const authContext = readRecoveryAuthContext(request);
    const dto = createResetPasswordAuthDto(payload, authContext);
    const result = await resetPassword(dto);

    return buildResponse(200, result);
  } catch (error) {
    return mapError(error, "Erro ao redefinir senha");
  }
}
