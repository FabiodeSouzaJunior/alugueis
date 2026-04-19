"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { loginWithPassword } from "../services/auth.service";
import { setBrowserSession } from "../services/auth-browser.service";
import { isValidEmail, normalizeEmail } from "../utils/auth-form.utils";

export function useLoginForm() {
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function submit(event) {
    event?.preventDefault?.();
    setError("");

    const normalized = normalizeEmail(email);

    if (!isValidEmail(normalized)) {
      setError("Email inválido");
      return;
    }

    if (!password) {
      setError("Informe sua senha");
      return;
    }

    try {
      setSubmitting(true);
      const result = await loginWithPassword(normalized, password);
      await setBrowserSession(result);
      router.replace("/imoveis");
    } catch (submitError) {
      setError(submitError?.message || "Falha ao entrar");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    error,
    submitting,
    submit,
  };
}
