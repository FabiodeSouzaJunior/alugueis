"use client";

import Link from "next/link";
import { Plus, CreditCard, Receipt, HardHat, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const actions = [
  { href: "/inquilinos", label: "Novo inquilino", icon: Plus, shortcut: "N" },
  { href: "/pagamentos", label: "Registrar pagamento", icon: CreditCard, shortcut: "P" },
  { href: "/despesas", label: "Adicionar despesa", icon: Receipt, shortcut: "D" },
  { href: "/obras", label: "Criar obra", icon: HardHat, shortcut: "O" },
  { href: "/manutencao", label: "Criar manutenção", icon: Wrench, shortcut: "M" },
];

export function QuickActionsDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Ações rápidas</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Ações rápidas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map(({ href, label, icon: Icon, shortcut }) => (
          <DropdownMenuItem key={href} asChild>
            <Link href={href} className="flex cursor-pointer items-center gap-2">
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {shortcut && (
                <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                  {shortcut}
                </kbd>
              )}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
