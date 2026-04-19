# SPEC — Login/Registro Multi-tenant (Design + Banco de Dados)

---

## BANCO DE DADOS

### Tabelas necessárias

#### `organizations`
| coluna       | tipo      | notas                                  |
|--------------|-----------|----------------------------------------|
| `id`         | uuid      | PRIMARY KEY                            |
| `email`      | text      | email do dono/administrador            |
| `created_at` | timestamp | default now()                          |

#### `invites`
| coluna            | tipo      | notas                             |
|-------------------|-----------|-----------------------------------|
| `id`              | uuid      | PRIMARY KEY                       |
| `email`           | text      | email do usuário convidado        |
| `organization_id` | uuid      | FK → organizations.id             |
| `created_at`      | timestamp | default now()                     |

#### `memberships`
| coluna            | tipo | notas                             |
|-------------------|------|-----------------------------------|
| `user_id`         | uuid | FK → auth.users(id)               |
| `organization_id` | uuid | FK → organizations.id             |
| PRIMARY KEY       | —    | (user_id, organization_id)        |

### Como o sistema usa essas tabelas

- **Precheck de email:** antes de mostrar os campos de senha no cadastro, o sistema busca o email do usuário em `invites` (primeiro) e depois em `organizations`. Se não encontrar em nenhuma, bloqueia o cadastro. Pesquisa é case-insensitive (`.ilike`).
- **Membership:** ao criar conta, o `user_id` gerado pelo Supabase é imediatamente vinculado ao `organization_id` encontrado no precheck via upsert na tabela `memberships`.
- **RLS:** cada tabela de negócio deve ter policy filtrando por `organization_id` vindo da `memberships` do usuário autenticado.

### Variáveis de ambiente necessárias

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key   # apenas no servidor, NUNCA no browser
```

---

## DESIGN E FRONT-END

### Tema

- **Modo escuro fixo** — o `<html>` tem `className="dark"` no layout raiz. NÃO há toggle de tema nas telas de auth.
- **Paleta (dark mode):**

| token CSS             | valor HSL    | uso principal                       |
|-----------------------|--------------|-------------------------------------|
| `--background`        | `0 0% 2%`    | fundo da página (preto quase puro)  |
| `--foreground`        | `0 0% 98%`   | texto principal (branco)            |
| `--card`              | `0 0% 5%`    | fundo do Card                       |
| `--card-foreground`   | `0 0% 98%`   | texto dentro do Card                |
| `--primary`           | `0 0% 100%`  | botão primário (branco)             |
| `--primary-foreground`| `0 0% 4%`    | texto no botão primário (preto)     |
| `--muted-foreground`  | `0 0% 55%`   | textos secundários, placeholders    |
| `--border`            | `0 0% 11%`   | bordas                              |
| `--input`             | `0 0% 9%`    | fundo dos inputs                    |
| `--destructive`       | `0 0% 55%`   | erros                               |
| `--radius`            | `0.5rem`     | raio de borda padrão                |

- **Font:** sans-serif do sistema (Tailwind `font-sans`), `antialiased`.

---

### Layout geral de todas as telas de auth

```
min-h-screen
  flex items-center justify-center
    px-4 py-10
      <Card> w-full max-w-md  (≈ 448px)
```

- Fundo da página: `bg-background` (preto 2%)
- **Nenhuma imagem de fundo, nenhum gradiente, nenhum logo.**
- O Card fica centralizado vertical e horizontalmente na tela.

---

### Card (shadcn/ui `<Card>`)

```
className="w-full max-w-md shadow-sm border-border/70 bg-card/80 backdrop-blur-sm"
```

| propriedade    | valor                                          |
|----------------|------------------------------------------------|
| largura máxima | `max-w-md` (448px)                             |
| sombra         | `shadow-sm` (sutil)                            |
| borda          | `border-border/70` (70% de opacidade)          |
| fundo          | `bg-card/80` (80% de opacidade)                |
| blur           | `backdrop-blur-sm`                             |
| padding interno| gerenciado pelos componentes `CardHeader`/`CardContent` |

---

### Tela `/login` — Login e Registro

#### Cabeçalho do Card

```
<CardHeader className="space-y-2">
  <CardTitle className="text-2xl">Entrar ou criar conta</CardTitle>
  <CardDescription>Multi-tenant com segurança por membership e RLS.</CardDescription>
</CardHeader>
```

#### Tabs

```
<Tabs defaultValue="register">
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger value="register">Criar conta</TabsTrigger>
    <TabsTrigger value="login">Entrar</TabsTrigger>
  </TabsList>
  <TabsContent value="register" className="mt-6"> ... </TabsContent>
  <TabsContent value="login"    className="mt-6"> ... </TabsContent>
</Tabs>
```

A **aba padrão ao abrir a página é "Criar conta"** (`defaultValue="register"`).

---

#### Aba "Criar conta" — Passo 1 (somente email visível)

```
<form className="space-y-5" aria-live="polite">

  <div className="space-y-2">
    <Label>Email</Label>
    <div className="relative">
      <Input
        type="email"
        autoComplete="email"
        inputMode="email"
        className="[normal] | [erro: border-destructive/70 focus-visible:ring-destructive/40]"
        aria-invalid={!!emailError}
      />
      <!-- enquanto verifica (debounce 500ms): -->
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        verificando...
      </div>
    </div>

    <!-- se há erro: -->
    <Alert variant="destructive" className="mt-2">
      <AlertTitle>Erro</AlertTitle>
      <AlertDescription>{emailError}</AlertDescription>
    </Alert>

    <!-- se não há erro: espaço reservado para não ter layout shift -->
    <div className="h-5" aria-hidden="true" />
  </div>

</form>
```

---

#### Aba "Criar conta" — Passo 2 (revelado com animação após email válido)

A revelação usa `framer-motion`:

```js
<AnimatePresence mode="wait">
  {organizationId && (
    <motion.div
      key="register-password-step"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
```

Conteúdo revelado:

```
[Label] Senha
[Input] type="password" autoComplete="new-password"
  classe normal:  focus-visible:ring-primary/40 focus-visible:border-primary/50
  classe erro:    border-destructive/70 focus-visible:ring-destructive/40
[texto vermelho inline]
  className="text-sm text-destructive mt-2"  role="alert"
  "A senha deve conter: mínimo 8 caracteres, 1 letra maiúscula, 1 número."

[Label] Confirmar senha
[Input] type="password" autoComplete="new-password"
[texto vermelho inline]
  "As senhas não coincidem."

[Alert variant="destructive"]  ← erro geral de submit (opcional, só se houver)

[Button type="submit" className="w-full" disabled={!canSubmit}>
  carregando: "Criando conta..."
  padrão:     "Criar Conta"

[p className="text-xs text-muted-foreground">
  "Ao criar a conta, seu usuário será vinculado automaticamente à organization correta."
```

---

#### Aba "Entrar"

```
<form className="space-y-5" aria-live="polite">

  <div className="space-y-2">
    <Label>Email</Label>
    <Input type="email" autoComplete="email" />
  </div>

  <div className="space-y-2">
    <div className="flex items-center justify-between gap-3">
      <Label>Senha</Label>
      <Button variant="link" size="sm" asChild className="h-auto p-0">
        <Link href="/forgot-password">Esqueci minha senha</Link>
      </Button>
    </div>
    <Input type="password" autoComplete="current-password" />
  </div>

  <Alert variant="destructive">  ← só se houver erro
    <AlertTitle>Erro</AlertTitle>
    <AlertDescription>{error}</AlertDescription>
  </Alert>

  <Button type="submit" className="w-full" disabled={submitting}>
    carregando: "Entrando..."
    padrão:     "Entrar"
  </Button>

</form>
```

---

### Tela `/forgot-password` — Recuperar Senha

```
<CardHeader className="space-y-2">
  <CardTitle className="text-2xl">Recuperar senha</CardTitle>
  <CardDescription>Informe seu email para receber o link seguro de redefinição via Supabase.</CardDescription>
</CardHeader>

<CardContent>
  <form className="space-y-5" aria-live="polite">

    [Label] Email
    [Input] type="email" autoComplete="email" inputMode="email"

    [Alert variant="destructive"]  ← se erro
    [Alert variant="success"]      ← se enviado:
      <AlertTitle>Verifique seu email</AlertTitle>
      <AlertDescription>{successMessage}</AlertDescription>

    [Button type="submit" className="w-full"]
      carregando: "Enviando..."
      padrão:     "Enviar link de recuperação"

    [Button variant="link" asChild className="w-full"]
      <Link href="/login">Voltar para login</Link>

  </form>
</CardContent>
```

---

### Tela `/reset-password` — Redefinir Senha

```
<CardHeader className="space-y-2">
  <CardTitle className="text-2xl">Redefinir senha</CardTitle>
  <CardDescription>Defina sua nova senha usando o link seguro enviado pelo Supabase.</CardDescription>
</CardHeader>

<CardContent>

  <!-- enquanto inicializa (lê tokens do hash da URL): -->
  <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
    Validando link de recuperação...
  </div>

  <!-- após inicializar: -->
  <form className="space-y-5" aria-live="polite">

    [Label] Email
    [Input] type="email" disabled readOnly  ← preenchido via token, não editável

    [Label] Nova senha
    [Input] type="password" autoComplete="new-password"
    [texto vermelho inline]  ← se senha inválida e campo não vazio

    [Label] Confirmar nova senha
    [Input] type="password" autoComplete="new-password"
    [texto vermelho inline]  ← se senhas não coincidem e campo não vazio

    [Alert variant="destructive"]  ← se erro
    [Alert variant="success"]      ← se senha atualizada com sucesso
      <AlertTitle>Senha atualizada</AlertTitle>

    [Button type="submit" className="w-full" disabled={!ready || submitting}>
      carregando: "Redefinindo..."
      padrão:     "Redefinir senha"

    [Button variant="link" asChild className="w-full"]
      se sucesso: <Link href="/login">Ir para login</Link>
      se não:     <Link href="/forgot-password">Solicitar novo link</Link>

  </form>

</CardContent>
```

---

### Tela de carregamento de sessão (AuthGate)

Exibida enquanto a sessão está sendo verificada ao entrar em qualquer rota protegida:

```
<div className="min-h-screen flex items-center justify-center px-4">
  <div className="w-full max-w-md rounded-lg border border-border/60 bg-card/70 p-6 text-center">
    <p className="text-sm text-muted-foreground">Carregando sessão...</p>
  </div>
</div>
```

---

### Regras de validação de senha

| regra               | mensagem exibida       |
|---------------------|------------------------|
| mínimo 8 caracteres | "mínimo 8 caracteres"  |
| 1 letra maiúscula   | "1 letra maiúscula"    |
| 1 número            | "1 número"             |

Erros são exibidos **inline abaixo do campo** (não em Alert):
```
className="text-sm text-destructive mt-2"
role="alert"
```
Formato da mensagem: `"A senha deve conter: mínimo 8 caracteres, 1 letra maiúscula."`  
Os erros só aparecem se o campo **não estiver vazio**.

---

### Componentes shadcn/ui utilizados

| componente    | variantes usadas                                                    |
|---------------|---------------------------------------------------------------------|
| `Alert`       | `destructive`, `success`                                            |
| `Button`      | `default` (primary), `link`                                         |
| `Card`        | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` |
| `Input`       | padrão                                                              |
| `Label`       | padrão                                                              |
| `Tabs`        | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`                    |

---

### Dependências npm

```bash
npm install @supabase/supabase-js framer-motion
```

- `tailwindcss-animate` — plugin já deve estar no `tailwind.config.js`
- shadcn/ui — instale os componentes listados acima via CLI do shadcn

---

### Rotas de página

| rota               | arquivo                        | componente             |
|--------------------|--------------------------------|------------------------|
| `/login`           | `app/login/page.js`            | `LoginRegisterScreen`  |
| `/forgot-password` | `app/forgot-password/page.js`  | `ForgotPasswordForm`   |
| `/reset-password`  | `app/reset-password/page.js`   | `ResetPasswordForm`    |
