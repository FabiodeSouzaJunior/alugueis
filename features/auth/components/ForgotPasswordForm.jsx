"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useForgotPasswordForm } from "../hooks/useForgotPasswordForm";

export default function ForgotPasswordForm() {
  const form = useForgotPasswordForm();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md shadow-sm border-border/70 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Recuperar senha</CardTitle>
          <CardDescription>
            Informe seu email para receber o link seguro de redefinição via Supabase.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={form.submit} className="space-y-5" aria-live="polite">
            <div className="space-y-2">
              <Label htmlFor="forgot-password-email">Email</Label>
              <Input
                id="forgot-password-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={form.email}
                onChange={(event) => form.setEmail(event.target.value)}
                aria-invalid={!!form.error}
              />
            </div>

            {form.error ? (
              <Alert variant="destructive">
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{form.error}</AlertDescription>
              </Alert>
            ) : null}

            {form.successMessage ? (
              <Alert variant="success">
                <AlertTitle>Verifique seu email</AlertTitle>
                <AlertDescription>{form.successMessage}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" className="w-full" disabled={form.submitting}>
              {form.submitting ? "Enviando..." : "Enviar link de recuperação"}
            </Button>

            <Button variant="link" asChild className="w-full">
              <Link href="/login">Voltar para login</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
