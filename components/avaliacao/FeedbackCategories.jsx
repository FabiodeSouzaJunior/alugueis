"use client";

import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Internet",
  "Infraestrutura",
  "Segurança",
  "Limpeza",
  "Ruído",
  "Manutenção",
  "Outro",
];

export function FeedbackCategories({ selected = [], onChange, disabled }) {
  const toggle = (cat) => {
    if (disabled) return;
    if (selected.includes(cat)) {
      onChange(selected.filter((c) => c !== cat));
    } else {
      onChange([...selected, cat]);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground/90">
        Onde acredita que melhorias podem ser feitas? (opcional, múltipla escolha)
      </p>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            disabled={disabled}
            onClick={() => toggle(cat)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
              "border focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background",
              selected.includes(cat)
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
