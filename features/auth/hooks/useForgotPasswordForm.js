"use client";

import * as React from "react";

import { requestPasswordReset } from "../services/auth.service";
import { isValidEmail, normalizeEmail } from "../utils/auth-form.utils";

export function useForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function submit(event) {
    event?.preventDefault?.();
    setError("");
    setSuccessMessage("");

    const normalized = normalizeEmail(email);

    if (!isValidEmail(normalized)) {
      setError("Email inválido");
      return;
    }

    try {
      setSubmitting(true);
      const result = await requestPasswordReset(normalized);
      setSuccessMessage(
        result?.message || "Se o email estiver cadastrado, você receberá um link de recuperação."
      );
    } catch (submitError) {
      setError(submitError?.message || "Erro ao solicitar recuperação de senha");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    email,
    setEmail,
    error,
    successMessage,
    submitting,
    submit,
  };
}
