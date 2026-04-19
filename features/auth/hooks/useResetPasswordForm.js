"use client";

import * as React from "react";

import {
  getBrowserSession,
  initializeRecoverySession,
  signOutBrowserSession,
} from "../services/auth-browser.service";
import { resetPassword } from "../services/auth.service";
import { validatePassword } from "../utils/auth-form.utils";

export function useResetPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");
  const [initializing, setInitializing] = React.useState(true);
  const [ready, setReady] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const passwordValidation = React.useMemo(
    () => validatePassword(password),
    [password]
  );

  const passwordsMatch = React.useMemo(() => {
    if (!confirmPassword) return true;
    return String(confirmPassword) === String(password);
  }, [confirmPassword, password]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadRecoverySession() {
      try {
        setInitializing(true);
        const result = await initializeRecoverySession();

        if (cancelled) return;

        setEmail(String(result.user.email || ""));
        setReady(true);
      } catch (loadError) {
        if (cancelled) return;

        setError(loadError?.message || "Link de recuperação inválido ou expirado");
        setReady(false);
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    }

    loadRecoverySession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event) {
    event?.preventDefault?.();
    setError("");
    setSuccessMessage("");

    if (!ready) {
      setError("Link de recuperação inválido ou expirado");
      return;
    }

    if (!passwordValidation.valid) {
      setError(`Senha inválida: ${passwordValidation.issues.join(", ")}`);
      return;
    }

    if (!confirmPassword || !passwordsMatch) {
      setError("As senhas não coincidem");
      return;
    }

    try {
      setSubmitting(true);
      const session = await getBrowserSession();

      if (!session?.access_token || !session?.refresh_token) {
        throw new Error("Sessão de recuperação inválida ou expirada");
      }

      const result = await resetPassword(
        {
          email,
          newPassword: password,
          confirmPassword,
        },
        {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        }
      );

      await signOutBrowserSession().catch(() => {});

      setSuccessMessage(result?.message || "Senha redefinida com sucesso.");
      setReady(false);
    } catch (submitError) {
      setError(submitError?.message || "Erro ao redefinir senha");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    email,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    passwordValidation,
    passwordsMatch,
    error,
    successMessage,
    initializing,
    ready,
    submitting,
    submit,
  };
}
