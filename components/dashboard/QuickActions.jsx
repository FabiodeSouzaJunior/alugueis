"use client";

import Link from "next/link";
import { Plus, CreditCard, Receipt, HardHat, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const actions = [
  { href: "/inquilinos", label: "Novo inquilino", icon: Plus },
  { href: "/pagamentos", label: "Registrar pagamento", icon: CreditCard },
  { href: "/despesas", label: "Adicionar despesa", icon: Receipt },
  { href: "/obras", label: "Criar obra", icon: HardHat },
  { href: "/manutencao", label: "Criar manutenção", icon: Wrench },
];

export function QuickActions({ className }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {actions.map(({ href, label, icon: Icon }) => (
        <Button key={href} variant="outline" size="sm" asChild>
          <Link href={href} className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        </Button>
      ))}
    </div>
  );
}
