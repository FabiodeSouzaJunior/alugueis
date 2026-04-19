"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, CalendarDays, List } from "lucide-react";

/**
 * Toolbar de navegação para calendário — estilo SaaS premium.
 * Agrupa: navegação (anterior/próximo), label do período e segment control (Mês/Agenda).
 *
 * @param {string} label - Texto do período atual (ex.: "Março 2025")
 * @param {function} onNavigate - (action: 'PREV' | 'NEXT') => void
 * @param {string} view - 'month' | 'agenda'
 * @param {function} onView - (view: 'month' | 'agenda') => void
 */
export function CalendarToolbar({ label, onNavigate, view, onView }) {
  return (
    <header
      className="calendar-toolbar mb-5 flex w-full flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3 shadow-sm [&_button]:border-0 [&_button]:bg-transparent [&_button]:shadow-none"
      role="toolbar"
      aria-label="Navegação do calendário"
    >
      {/* Navegação: Anterior / Próximo */}
      <nav
        className="flex shrink-0 items-center gap-0.5"
        aria-label="Navegar entre períodos"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-lg text-white transition-colors hover:bg-muted hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:text-white"
          onClick={() => onNavigate("PREV")}
          aria-label="Período anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-lg text-white transition-colors hover:bg-muted hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:text-white"
          onClick={() => onNavigate("NEXT")}
          aria-label="Próximo período"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </nav>

      {/* Label central: mês/periodo */}
      <div className="calendar-toolbar-label min-w-0 flex-1 text-center">
        <h2 className="truncate text-xl font-semibold tracking-tight text-foreground">
          {label}
        </h2>
      </div>

      {/* Segmented control: Mês | Agenda */}
      <div
        className="inline-flex shrink-0 rounded-lg bg-muted/50 p-1"
        role="group"
        aria-label="Tipo de visualização"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-2 rounded-md px-4 text-sm font-medium text-foreground transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:text-white",
            view === "month"
              ? "bg-background shadow-sm"
              : "hover:bg-background/70"
          )}
          onClick={() => onView("month")}
          aria-pressed={view === "month"}
          aria-label="Visualização em mês"
        >
          <CalendarDays className="h-4 w-4 shrink-0" />
          Mês
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-2 rounded-md px-4 text-sm font-medium text-foreground transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:text-white",
            view === "agenda"
              ? "bg-background shadow-sm"
              : "hover:bg-background/70"
          )}
          onClick={() => onView("agenda")}
          aria-pressed={view === "agenda"}
          aria-label="Visualização em agenda"
        >
          <List className="h-4 w-4 shrink-0" />
          Agenda
        </Button>
      </div>
    </header>
  );
}
