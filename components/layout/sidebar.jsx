"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  AlertCircle,
  Wrench,
  Receipt,
  Droplets,
  BarChart3,
  HardHat,
  Building2,
  Target,
  Bell,
  X,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const NAV_GROUPS = [
  {
    label: "Visão geral",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, iconColor: "text-blue-500" },
      { href: "/relatorios", label: "Relatórios", icon: BarChart3, iconColor: "text-slate-500" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/pagamentos", label: "Pagamentos", icon: CreditCard, iconColor: "text-emerald-600 dark:text-emerald-400" },
      { href: "/inadimplentes", label: "Inadimplentes", icon: AlertCircle, iconColor: "text-red-400 dark:text-red-400" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/inquilinos", label: "Inquilinos", icon: Users, iconColor: "text-slate-500" },
      { href: "/imoveis", label: "Imóveis", icon: Building2, iconColor: "text-emerald-600 dark:text-emerald-500" },
      { href: "/obras", label: "Obras", icon: HardHat, iconColor: "text-amber-500 dark:text-amber-400" },
      { href: "/manutencao", label: "Manutenção", icon: Wrench, iconColor: "text-slate-500" },
      { href: "/despesas", label: "Despesas", icon: Receipt, iconColor: "text-red-400 dark:text-red-400" },
      { href: "/agua-luz", label: "Água e Luz", icon: Droplets, iconColor: "text-sky-500" },
    ],
  },
  {
    label: "Condomínio e CRM",
    items: [
      { href: "/condominio", label: "Condomínio", icon: Building2, iconColor: "text-sky-500 dark:text-sky-400" },
      { href: "/crm", label: "CRM", icon: Target, iconColor: "text-violet-500 dark:text-violet-400" },
    ],
  },
  {
    label: null,
    items: [{ href: "/notifications", label: "Notificações", icon: Bell, iconColor: "text-slate-500" }],
  },
];

function NavLink({ href, label, icon: Icon, isActive, onClick, iconColor }) {
  return (
    <motion.div initial={false} whileHover={{ x: 2 }} transition={{ duration: 0.15 }}>
      <Link
        href={href}
        prefetch
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
            isActive ? "bg-primary-foreground/20" : "bg-muted/50"
          )}
        >
          <Icon className={cn("h-5 w-5", !isActive && iconColor)} />
        </span>
        <span className="flex-1">{label}</span>
        {isActive && <ChevronRight className="h-4 w-4 shrink-0 opacity-80" />}
      </Link>
    </motion.div>
  );
}

export function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    NAV_GROUPS.flatMap((group) => group.items).forEach((item) => {
      router.prefetch(item.href);
    });
  }, [router]);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-border bg-card transition-transform duration-200 ease-out md:translate-x-0",
          open ? "translate-x-0 shadow-xl" : "-translate-x-full md:translate-x-0 md:shadow-none"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:justify-center">
          <Link href="/imoveis" prefetch className="font-semibold" onClick={onClose}>
            <span className="text-xl tracking-tight text-foreground">Imóveis</span>
          </Link>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden py-3 scrollbar-hide">
          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={group.label ?? `group-${groupIndex}`} className="px-3">
              {group.label && (
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <NavLink
                        href={item.href}
                        label={item.label}
                        icon={item.icon}
                        isActive={isActive}
                        onClick={onClose}
                        iconColor={item.iconColor}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
