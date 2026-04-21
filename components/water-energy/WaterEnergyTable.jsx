"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Droplets, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

function formatConsumption(value) {
  return Number(value).toFixed(2).replace(".", ",");
}

const COLUMNS = [
  { key: "tenant", label: "Inquilino" },
  { key: "kitnet", label: "Kitnet" },
  { key: "water", label: "Consumo de Água" },
  { key: "electricity", label: "Consumo de Luz" },
  { key: "total", label: "Total do mês" },
  { key: "variation", label: "Variação vs mês anterior" },
  { key: "actions", label: "" },
];

export function WaterEnergyTable({
  rows = [],
  loading,
  sortBy,
  sortDir,
  onSort,
  search,
  onSearch,
  onRowClick,
  onEdit,
}) {
  const filtered = useMemo(() => {
    if (!search?.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (r.tenant?.name || "").toLowerCase().includes(q));
  }, [rows, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let va = a[sortBy];
      let vb = b[sortBy];
      if (sortBy === "tenant") {
        va = a.tenant?.name ?? "";
        vb = b.tenant?.name ?? "";
        return dir * (String(va).localeCompare(String(vb)));
      }
      if (sortBy === "kitnet") {
        va = a.tenant?.kitnetNumber ?? "";
        vb = b.tenant?.kitnetNumber ?? "";
        return dir * (String(va).localeCompare(String(vb)));
      }
      if (sortBy === "variation") {
        va = a.variation ?? -Infinity;
        vb = b.variation ?? -Infinity;
        return dir * (va - vb);
      }
      va = Number(va) ?? 0;
      vb = Number(vb) ?? 0;
      return dir * (va - vb);
    });
    return list;
  }, [filtered, sortBy, sortDir]);

  const topTwoTotal = useMemo(() => {
    const totals = rows.map((r) => r.total).filter((t) => t != null);
    if (totals.length === 0) return new Set();
    const sortedTotals = [...new Set(totals)].sort((a, b) => b - a);
    const threshold = sortedTotals[1] ?? sortedTotals[0];
    return new Set(rows.filter((r) => r.total >= threshold && r.total > 0).map((r) => r.tenant?.id));
  }, [rows]);

  const handleHeaderClick = (key) => {
    if (key === "actions") return;
    if (key !== "tenant" && key !== "kitnet" && key !== "water" && key !== "electricity" && key !== "total" && key !== "variation") return;
    const nextDir = sortBy === key && sortDir === "desc" ? "asc" : "desc";
    onSort?.(key, nextDir);
  };

  if (loading) {
    return (
      <Card className="rounded-xl border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Consumo mensal</CardTitle>
          <CardDescription>Por inquilino — clique na linha para ver histórico</CardDescription>
        </CardHeader>
        <CardContent>
          <SkeletonTable rows={6} cols={6} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border border-border shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Consumo mensal</CardTitle>
            <CardDescription>Por inquilino — clique na linha para ver histórico</CardDescription>
          </div>
          <Input
            placeholder="Buscar por nome..."
            value={search ?? ""}
            onChange={(e) => onSearch?.(e.target.value)}
            className="w-full sm:max-w-xs"
          />
        </div>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <EmptyState
            icon={Droplets}
            title="Nenhum consumo para exibir"
            description="Não há inquilinos ativos ou consumos registrados para o período."
          />
        ) : (
          <div className="overflow-visible">
            <Table mobileCards>
              <TableHeader>
                <TableRow>
                  {COLUMNS.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn(
                        "cursor-pointer select-none whitespace-nowrap",
                        sortBy === col.key && "text-foreground"
                      )}
                      onClick={() => handleHeaderClick(col.key)}
                    >
                      {col.label}
                      {sortBy === col.key && (
                        <span className="ml-1 text-muted-foreground">{sortDir === "asc" ? "↑" : "↓"}</span>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => {
                  const isTopConsumer = topTwoTotal.has(row.tenant?.id);
                  return (
                    <TableRow
                      key={row.tenant?.id}
                      className={cn(
                        "cursor-pointer",
                        isTopConsumer && "bg-amber-500/5 border-l-4 border-l-amber-500"
                      )}
                      onClick={() => onRowClick?.(row)}
                    >
                      <TableCell data-mobile-primary="true" className="font-medium">{row.tenant?.name ?? "—"}</TableCell>
                      <TableCell data-label="Kitnet">{row.tenant?.kitnetNumber ?? "—"}</TableCell>
                      <TableCell data-label="Agua" className="tabular-nums">{formatConsumption(row.water)}</TableCell>
                      <TableCell data-label="Luz" className="tabular-nums">{formatConsumption(row.electricity)}</TableCell>
                      <TableCell data-label="Total" className="font-semibold tabular-nums">{formatConsumption(row.total)}</TableCell>
                      <TableCell data-label="Variacao">
                        {row.variation != null ? (
                          <span
                            className={cn(
                              "font-medium tabular-nums",
                              row.variation > 0 && "text-red-600 dark:text-red-400",
                              row.variation < 0 && "text-green-600 dark:text-green-400",
                              row.variation === 0 && "text-muted-foreground"
                            )}
                          >
                            {row.variation > 0 ? "+" : ""}{row.variation.toFixed(1)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell data-mobile-actions="true">
                        {row.currentRecord && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit?.(row);
                            }}
                            title="Editar consumo"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
