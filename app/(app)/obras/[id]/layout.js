"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePageHeader } from "@/context/page-header";
import { fetchObra } from "@/lib/api";
import {
  LayoutDashboard,
  DollarSign,
  Package,
  Users,
  ListChecks,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "etapas", label: "Etapas", icon: ListChecks },
  { href: "custos", label: "Custos", icon: DollarSign },
  { href: "materiais", label: "Materiais", icon: Package },
  { href: "trabalhadores", label: "mão de Obra", icon: Users },
  { href: "agenda", label: "Agenda", icon: Calendar },
];

export default function ObraLayout({ children }) {
  const params = useParams();
  const pathname = usePathname();
  const id = params.id;
  const [obra, setObra] = useState(null);
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    if (!id) return;
    fetchObra(id)
      .then(setObra)
      .catch(() => setObra(null));
  }, [id]);

  useEffect(() => {
    if (!obra) return;
    setPageHeader({
      title: obra.name,
      description: "Gestão da obra",
      action: (
        <Button variant="outline" size="sm" asChild>
          <Link href="/obras">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar às obras
          </Link>
        </Button>
      ),
    });
    return () => setPageHeader({ title: null, description: null, action: null });
  }, [obra, setPageHeader]);

  if (!id) return null;

  const base = `/obras/${id}`;
  const current = pathname?.replace(base, "").replace(/^\//, "") || "dashboard";

  return (
    <div className="space-y-6">
      <nav className="grid grid-cols-2 gap-2 overflow-visible rounded-lg border border-border bg-card p-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
        {navItems.map((item) => {
          const href = `${base}/${item.href}`;
          const isActive = current === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex min-w-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-center text-sm font-medium transition-colors lg:shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
