"use client";

export default function GlobalError({ error, reset }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
          <h2 className="text-lg font-semibold">Erro crítico</h2>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            {error?.message || "Erro inesperado."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
