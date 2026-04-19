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

import { useResetPasswordForm } from "../hooks/useResetPasswordForm";

export default function ResetPasswordForm() {
  const form = useResetPasswordForm();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md shadow-sm border-border/70 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Redefinir senha</CardTitle>
          <CardDescription>
            Defina sua nova senha usando o link seguro enviado pelo Supabase.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {form.initializing ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
              Validando link de recuperação...
            </div>
          ) : (
            <form onSubmit={form.submit} className="space-y-5" aria-live="polite">
              <div className="space-y-2">
                <Label htmlFor="reset-password-email">Email</Label>
                <Input
                  id="reset-password-email"
                  type="email"
                  value={form.email}
                  disabled
                  readOnly
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-password-new">Nova senha</Label>
                <Input
                  id="reset-password-new"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => form.setPassword(event.target.value)}
                  disabled={!form.ready || form.submitting}
                  aria-invalid={!form.passwordValidation.valid && form.password.length > 0}
                />
                {!form.passwordValidation.valid && form.password.length > 0 ? (
                  <div className="text-sm text-destructive" role="alert">
                    A senha deve conter: {form.passwordValidation.issues.join(", ")}.
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-password-confirm">Confirmar nova senha</Label>
                <Input
                  id="reset-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(event) => form.setConfirmPassword(event.target.value)}
                  disabled={!form.ready || form.submitting}
                  aria-invalid={!!form.confirmPassword && !form.passwordsMatch}
                />
                {!form.passwordsMatch && form.confirmPassword.length > 0 ? (
                  <div className="text-sm text-destructive" role="alert">
                    As senhas não coincidem.
                  </div>
                ) : null}
              </div>

              {form.error ? (
                <Alert variant="destructive">
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>{form.error}</AlertDescription>
                </Alert>
              ) : null}

              {form.successMessage ? (
                <Alert variant="success">
                  <AlertTitle>Senha atualizada</AlertTitle>
                  <AlertDescription>{form.successMessage}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                type="submit"
                className="w-full"
                disabled={!form.ready || form.submitting}
              >
                {form.submitting ? "Redefinindo..." : "Redefinir senha"}
              </Button>

              <Button variant="link" asChild className="w-full">
                <Link href={form.successMessage ? "/login" : "/forgot-password"}>
                  {form.successMessage ? "Ir para login" : "Solicitar novo link"}
                </Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
