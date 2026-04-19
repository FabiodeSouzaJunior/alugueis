/**
 * Sistema global de cores para dados em gráficos e dashboards.
 * Semântica: receita/sucesso, despesa/danger, warning/atraso, info/água, energy/luz, construction/obras.
 * Cores suaves e consistentes com o ERP.
 */
export const dataColors = {
  revenue: "#10b981",
  expense: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
  energy: "#eab308",
  construction: "#8b5cf6",
  neutral: "#64748b",
  primary: "hsl(var(--primary))",
};

/** Paleta para múltiplas categorias (barras/fatias). */
export const categoryPalette = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

/**
 * Classes Tailwind para acento em cards/headers de dashboard (borda esquerda + fundo suave).
 * Uso: ChartCard, Card headers, seções.
 */
export const accentCardClasses = {
  revenue:
    "border-l-4 border-l-emerald-500/60 bg-emerald-500/5 dark:bg-emerald-500/10",
  expense:
    "border-l-4 border-l-red-500/60 bg-red-500/5 dark:bg-red-500/10",
  warning:
    "border-l-4 border-l-amber-500/60 bg-amber-500/5 dark:bg-amber-500/10",
  info:
    "border-l-4 border-l-blue-500/60 bg-blue-500/5 dark:bg-blue-500/10",
  energy:
    "border-l-4 border-l-amber-400/60 bg-amber-400/5 dark:bg-amber-400/10",
  construction:
    "border-l-4 border-l-violet-500/60 bg-violet-500/5 dark:bg-violet-500/10",
  neutral:
    "border-l-4 border-l-slate-500/60 bg-slate-500/5 dark:bg-slate-500/10",
  property:
    "border-l-4 border-l-emerald-600/60 bg-emerald-500/5 dark:bg-emerald-500/10",
};

/**
 * Classes para ícone em stat cards / insight cards (fundo + texto).
 */
export const accentIconClasses = {
  revenue:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  expense:
    "bg-red-500/10 text-red-600 dark:text-red-400",
  warning:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  info:
    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  energy:
    "bg-amber-400/10 text-amber-600 dark:text-amber-500",
  construction:
    "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  neutral:
    "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  property:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

/** Chaves de acento válidas para tipagem/documentação. */
export const accentKeys = [
  "revenue",
  "expense",
  "warning",
  "info",
  "energy",
  "construction",
  "neutral",
  "property",
];
