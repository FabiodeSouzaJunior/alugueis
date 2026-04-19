"use client";

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

export function CondominiumHistoryTable({
  billingHistory = [],
  formatCurrency,
}) {
  return (
    <Card className="overflow-hidden rounded-xl border border-border shadow-sm">
      <CardHeader className="border-b border-border/50 bg-muted/20">
        <CardTitle className="text-base font-semibold">Histórico de cobranças</CardTitle>
        <CardDescription>
          Valor base, despesas extras e total por mês/ano para auditoria.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {billingHistory.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 py-8 text-center text-sm text-muted-foreground">
            Nenhum dado de cobrança no período.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês/Ano</TableHead>
                <TableHead className="text-right">Valor base</TableHead>
                <TableHead className="text-right">Despesas extras</TableHead>
                <TableHead className="text-right">Total cobrado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {billingHistory.map((row) => (
                <TableRow key={`${row.year}-${row.month}`}>
                  <TableCell className="font-medium">{row.periodLabel}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(row.baseValue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(row.extrasTotal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatCurrency(row.totalValue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
