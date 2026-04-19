"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  precheckAuthEmail,
  registerWithPassword,
} from "../services/auth.service";
import { setBrowserSession } from "../services/auth-browser.service";
import {
  isValidEmail,
  normalizeEmail,
  validatePassword,
} from "../utils/auth-form.utils";

export function useRegisterForm() {
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [organizationId, setOrganizationId] = React.useState(null);
  const [hasAccount, setHasAccount] = React.useState(false);
  const [checkingEmail, setCheckingEmail] = React.useState(false);
  const [emailError, setEmailError] = React.useState("");

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [submitError, setSubmitError] = React.useState("");
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
    setOrganizationId(null);
    setHasAccount(false);
    setEmailError("");

    const normalized = normalizeEmail(email);

    if (!normalized) return;

    if (!isValidEmail(normalized)) {
      setEmailError("Email inválido");
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setCheckingEmail(true);
        const result = await precheckAuthEmail(normalized);

        if (!result?.allowed || !result?.organization_id) {
          setOrganizationId(null);
          setHasAccount(false);
          setEmailError("Email não registrado");
          return;
        }

        if (result.has_account) {
          setOrganizationId(null);
          setHasAccount(true);
          setEmailError("Este e-mail já está cadastrado. Faça login para continuar.");
          return;
        }

        setHasAccount(false);
        setOrganizationId(result.organization_id);
      } catch (_) {
        setOrganizationId(null);
        setHasAccount(false);
        setEmailError("Email não registrado");
      } finally {
        setCheckingEmail(false);
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [email]);

  async function submit(event) {
    event?.preventDefault?.();
    setSubmitError("");

    const normalized = normalizeEmail(email);

    if (!organizationId) {
      setSubmitError("Email não registrado");
      return;
    }

    if (!isValidEmail(normalized)) {
      setSubmitError("Email inválido");
      return;
    }

    if (!passwordValidation.valid) {
      setSubmitError(`Senha inválida: ${passwordValidation.issues.join(", ")}`);
      return;
    }

    if (!confirmPassword || !passwordsMatch) {
      setSubmitError("As senhas não coincidem");
      return;
    }

    try {
      setSubmitting(true);
      const result = await registerWithPassword(normalized, password);
      await setBrowserSession(result);
      router.replace("/imoveis");
    } catch (error) {
      setSubmitError(error?.message || "Erro ao criar conta");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    email,
    setEmail,
    checkingEmail,
    emailError,
    hasAccount,
    organizationId,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    passwordValidation,
    passwordsMatch,
    submitError,
    submitting,
    canSubmit:
      !!organizationId &&
      isValidEmail(normalizeEmail(email)) &&
      passwordValidation.valid &&
      !!confirmPassword &&
      passwordsMatch &&
      !submitting,
    submit,
  };
}
