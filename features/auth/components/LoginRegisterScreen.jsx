"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useLoginForm } from "../hooks/useLoginForm";
import { useRegisterForm } from "../hooks/useRegisterForm";

export default function LoginRegisterScreen() {
  const registerForm = useRegisterForm();
  const loginForm = useLoginForm();
  const [tab, setTab] = React.useState("login");

  const showPasswordStep = !!registerForm.organizationId;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md shadow-sm border-border/70 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Entrar ou criar conta</CardTitle>
        </CardHeader>

        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="register" className="mt-6">
              <form onSubmit={registerForm.submit} className="space-y-5" aria-live="polite">
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <div className="relative">
                    <Input
                      id="register-email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={registerForm.email}
                      onChange={(event) => registerForm.setEmail(event.target.value)}
                      disabled={registerForm.checkingEmail || registerForm.submitting}
                      className={[
                        "transition-shadow duration-200",
                        registerForm.emailError
                          ? "border-destructive/70 focus-visible:ring-destructive/40"
                          : "focus-visible:ring-primary/40 focus-visible:border-primary/50",
                      ].join(" ")}
                      aria-invalid={!!registerForm.emailError}
                    />
                    {registerForm.checkingEmail && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        verificando...
                      </div>
                    )}
                  </div>
                  {registerForm.emailError ? (
                    <Alert
                      variant={registerForm.hasAccount ? "default" : "destructive"}
                      className="mt-2"
                    >
                      <AlertTitle>
                        {registerForm.hasAccount ? "Conta existente" : "Erro"}
                      </AlertTitle>
                      <AlertDescription className="flex flex-col gap-2">
                        <span>{registerForm.emailError}</span>
                        {registerForm.hasAccount && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-fit"
                            onClick={() => {
                              loginForm.setEmail(registerForm.email);
                              setTab("login");
                            }}
                          >
                            Fazer login →
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="h-5" aria-hidden="true" />
                  )}
                </div>

                <AnimatePresence mode="wait">
                  {showPasswordStep && (
                    <motion.div
                      key="register-password-step"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="register-password">Senha</Label>
                        <Input
                          id="register-password"
                          type="password"
                          autoComplete="new-password"
                          value={registerForm.password}
                          onChange={(event) => registerForm.setPassword(event.target.value)}
                          disabled={registerForm.submitting}
                          className={[
                            "transition-shadow duration-200",
                            !registerForm.passwordValidation.valid && registerForm.password.length > 0
                              ? "border-destructive/70 focus-visible:ring-destructive/40"
                              : "focus-visible:ring-primary/40 focus-visible:border-primary/50",
                          ].join(" ")}
                          aria-invalid={
                            !registerForm.passwordValidation.valid &&
                            registerForm.password.length > 0
                          }
                        />
                        {!registerForm.passwordValidation.valid &&
                          registerForm.password.length > 0 && (
                            <div className="text-sm text-destructive mt-2" role="alert">
                              A senha deve conter:{" "}
                              {registerForm.passwordValidation.issues.join(", ")}.
                            </div>
                          )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="register-confirm-password">Confirmar senha</Label>
                        <Input
                          id="register-confirm-password"
                          type="password"
                          autoComplete="new-password"
                          value={registerForm.confirmPassword}
                          onChange={(event) => registerForm.setConfirmPassword(event.target.value)}
                          disabled={registerForm.submitting}
                          className={[
                            "transition-shadow duration-200",
                            !registerForm.passwordsMatch && registerForm.confirmPassword.length > 0
                              ? "border-destructive/70 focus-visible:ring-destructive/40"
                              : "focus-visible:ring-primary/40 focus-visible:border-primary/50",
                          ].join(" ")}
                          aria-invalid={
                            !!registerForm.confirmPassword && !registerForm.passwordsMatch
                          }
                        />
                        {!registerForm.passwordsMatch &&
                          registerForm.confirmPassword.length > 0 && (
                            <div className="text-sm text-destructive mt-2" role="alert">
                              As senhas não coincidem.
                            </div>
                          )}
                      </div>

                      {registerForm.submitError ? (
                        <Alert variant="destructive">
                          <AlertTitle>Erro</AlertTitle>
                          <AlertDescription>{registerForm.submitError}</AlertDescription>
                        </Alert>
                      ) : null}

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={!registerForm.canSubmit}
                      >
                        {registerForm.submitting ? "Criando conta..." : "Criar Conta"}
                      </Button>

                      <div className="text-xs text-muted-foreground">
                        Ao criar a conta, seu usuário será vinculado automaticamente à
                        organization correta.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </TabsContent>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={loginForm.submit} className="space-y-5" aria-live="polite">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={loginForm.email}
                    onChange={(event) => loginForm.setEmail(event.target.value)}
                    aria-invalid={!!loginForm.error}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="login-password">Senha</Label>
                    <Button variant="link" size="sm" asChild className="h-auto p-0">
                      <Link href="/forgot-password">Esqueci minha senha</Link>
                    </Button>
                  </div>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={loginForm.password}
                    onChange={(event) => loginForm.setPassword(event.target.value)}
                  />
                </div>

                {loginForm.error ? (
                  <Alert variant="destructive">
                    <AlertTitle>Erro</AlertTitle>
                    <AlertDescription>{loginForm.error}</AlertDescription>
                  </Alert>
                ) : null}

                <Button type="submit" className="w-full" disabled={loginForm.submitting}>
                  {loginForm.submitting ? "Entrando..." : "Entrar"}
                </Button>

                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  onClick={() => setTab("register")}
                >
                  Criar conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
