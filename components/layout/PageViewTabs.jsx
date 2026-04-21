"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const BASE_VIEWS = [
  { value: "tabela", label: "Tabela" },
  { value: "dashboard", label: "Dashboard" },
  { value: "insights", label: "Insights" },
];

/**
 * PageViewTabs — Abas de visualização: Tabela | Dashboard | Insights | (extra).
 * Reutilizável em Pagamentos, Inadimplentes, Água e Luz, Obras.
 * Dashboard e Insights são montados apenas quando a aba está ativa (lazy).
 */
export function PageViewTabs({
  value,
  onValueChange,
  tabelaContent,
  dashboardContent,
  insightsContent,
  extraTabs = [],
  hideInsights = false,
  className,
}) {
  const baseViews = hideInsights
    ? BASE_VIEWS.filter((view) => view.value !== "insights")
    : BASE_VIEWS;
  const views = extraTabs.length > 0
    ? [...baseViews, ...extraTabs.map((t) => ({ value: t.value, label: t.label }))]
    : baseViews;
  return (
    <div className={cn("space-y-6", className)}>
      <Tabs
        value={value}
        onValueChange={(v) => v && onValueChange(v)}
        className="w-full"
      >
        <TabsList
          className={cn(
            "h-auto w-full max-w-full justify-start gap-0 overflow-x-auto rounded-lg bg-transparent p-0",
            "border-b border-border scrollbar-hide sm:h-11 sm:max-w-md"
          )}
        >
          {views.map((view) => (
            <TabsTrigger
              key={view.value}
              value={view.value}
              className={cn(
                "relative shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-none transition-all sm:px-5",
                "hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
              )}
            >
              {view.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent
          value="tabela"
          className="mt-6 focus-visible:outline-none focus-visible:ring-0"
          forceMount
          hidden={value !== "tabela"}
        >
          <div className={cn("animate-in fade-in-0 duration-200", value !== "tabela" && "hidden")}>
            {tabelaContent}
          </div>
        </TabsContent>

        <TabsContent
          value="dashboard"
          className="mt-6 focus-visible:outline-none focus-visible:ring-0"
          forceMount
          hidden={value !== "dashboard"}
        >
          {value === "dashboard" && (
            <div className="animate-in fade-in-0 duration-200">
              {dashboardContent}
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="insights"
          className="mt-6 focus-visible:outline-none focus-visible:ring-0"
          forceMount
          hidden={value !== "insights"}
        >
          {value === "insights" && (
            <div className="animate-in fade-in-0 duration-200">
              {insightsContent}
            </div>
          )}
        </TabsContent>

        {extraTabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className="mt-6 focus-visible:outline-none focus-visible:ring-0"
            forceMount
            hidden={value !== tab.value}
          >
            {value === tab.value && (
              <div className="animate-in fade-in-0 duration-200">
                {tab.content}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
