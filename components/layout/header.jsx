"use client";

import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageHeader } from "@/context/page-header";
import { useAppFilters } from "@/context/app-filters";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { QuickActionsDropdown } from "./QuickActionsDropdown";
import { ThemeToggle } from "./ThemeToggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMonthName } from "@/lib/utils";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: getMonthName(i + 1) }));
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export function Header({ onMenuClick, onOpenSearch }) {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const { title, description, action } = usePageHeader();
  const { month, year, setMonth, setYear } = useAppFilters();

  if (isDashboard) {
    return (
      <header className="sticky top-0 z-30 grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            onClick={onMenuClick}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden items-center gap-2 sm:flex">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-9 w-[90px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex min-w-0 justify-center px-2">
          <button
            type="button"
            onClick={() => onOpenSearch?.(true)}
            className="flex w-full max-w-xl items-center gap-3 rounded-xl border border-input bg-muted/30 px-4 py-3 text-left text-muted-foreground transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Buscar (Ctrl+K)"
          >
            <Search className="h-5 w-5 shrink-0" />
            <span className="flex-1 truncate text-sm">Buscar inquilinos, pagamentos, obras...</span>
            <kbd className="hidden shrink-0 rounded border border-border bg-background/80 px-2 py-0.5 text-xs font-mono md:inline">
              Ctrl+K
            </kbd>
          </button>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1">
          <ThemeToggle />
          <NotificationBell />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 flex min-h-16 flex-col justify-center border-b border-border bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            onClick={onMenuClick}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            {title != null && (
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {title}
              </h2>
            )}
            {description != null && (
              <p className="text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => onOpenSearch?.(true)}
            aria-label="Buscar (Ctrl+K)"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Buscar</span>
            <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground md:inline">
              Ctrl+K
            </kbd>
          </Button>
          <ThemeToggle />
          <QuickActionsDropdown />
          <NotificationBell />
          {action != null && action}
        </div>
      </div>
    </header>
  );
}
