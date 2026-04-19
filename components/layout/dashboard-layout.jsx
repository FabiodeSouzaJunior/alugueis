"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { PageHeaderProvider } from "@/context/page-header";
import { AppFiltersProvider } from "@/context/app-filters";
import { KeyboardShortcutsProvider } from "@/context/keyboard-shortcuts";
import { GlobalSearch } from "./GlobalSearch";

export function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <PageHeaderProvider>
      <AppFiltersProvider>
      <KeyboardShortcutsProvider onOpenSearch={setSearchOpen}>
        <div className="min-h-screen bg-background">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="min-h-screen md:pl-64">
            <Header
              onMenuClick={() => setSidebarOpen(true)}
              onOpenSearch={setSearchOpen}
            />
            <main className="p-4 md:p-6">{children}</main>
          </div>
        </div>
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      </KeyboardShortcutsProvider>
      </AppFiltersProvider>
    </PageHeaderProvider>
  );
}
