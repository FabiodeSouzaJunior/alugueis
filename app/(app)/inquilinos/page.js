"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { usePageHeader } from "@/context/page-header";
import Link from "next/link";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContentWithClose,
} from "@/components/ui/dialog";
import { TenantForm } from "@/features/tenants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { fetchProperties } from "@/lib/api";
import {
  createTenant,
  deleteTenant,
  fetchTenants,
  generateTenantPayments,
  updateTenant,
  uploadTenantContract,
} from "@/features/tenants";
import { Plus, Pencil, Trash2, History, Search, ChevronDown, ChevronRight, Users, Building2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function InquilinosPage() {
  const [tenants, setTenantsState] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setLoading(true);
      const [tenantsData, propertiesData] = await Promise.all([fetchTenants(), fetchProperties()]);
      setTenantsState(Array.isArray(tenantsData) ? tenantsData : []);
      setProperties(Array.isArray(propertiesData) ? propertiesData : []);
    } catch (e) {
      console.error(e);
      setTenantsState([]);
      setProperties([]);
      setLoadError(e?.message || "Erro ao carregar. Verifique o servidor e o banco.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback(async (payload) => {
    setSaveError(null);

    // Extract contract file from payload (injected by TenantForm)
    const contractFile = payload.__contractFile || null;
    delete payload.__contractFile;
    delete payload.__contractRemoved;

    try {
      let result;
      if (editingTenant) {
        const updatePayload = {
          ...payload,
          rentValue: payload.rentValue ?? editingTenant.rentValue,
          propertyId: payload.propertyId !== undefined ? payload.propertyId : editingTenant.propertyId,
        };
        result = await updateTenant(editingTenant.id, updatePayload);
      } else {
        const rentValue = payload.rentValue ?? 0;
        const createPayload = {
          ...payload,
          rentValue,
          propertyId: payload.propertyId ?? null,
        };
        const created = await createTenant(createPayload);
        result = created;
        if (created && created.isPaymentResponsible && created.status === "ativo" && created.startDate) {
          await generateTenantPayments(created.id, created.rentValue, created.startDate);
        }
      }

      // Upload contract file if provided
      const tenantId = result?.id || editingTenant?.id;
      if (contractFile && tenantId) {
        try {
          await uploadTenantContract(tenantId, contractFile);
        } catch (uploadErr) {
          console.error("Erro ao enviar contrato:", uploadErr);
          // Save succeeded but upload failed — don't block the flow
          setSaveError("Inquilino salvo, mas houve erro ao enviar o contrato: " + (uploadErr?.message || "Tente novamente."));
        }
      }

      setDialogOpen(false);
      setEditingTenant(null);
      setSaveError(null);
      await load();
      return result;
    } catch (e) {
      console.error(e);
      setSaveError(e?.message || "Erro ao salvar. Tente novamente.");
    }
  }, [editingTenant, load]);

  const { setPageHeader } = usePageHeader();
  useEffect(() => {
    setPageHeader({
      title: "Inquilinos",
      description: "Gerencie os inquilinos e dados das kitnets.",
      action: (
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingTenant(null); setSaveError(null); } }}>
          <Button
            type="button"
            onClick={() => {
              setEditingTenant(null);
              setSaveError(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Inquilino
          </Button>
          <DialogContentWithClose
            className="flex h-[min(92vh,860px)] w-[min(96vw,1080px)] max-w-none flex-col overflow-hidden p-0"
            headerClassName="border-b border-border bg-background px-6 py-5"
            contentClassName="flex-1 overflow-hidden bg-muted/10 px-6 py-5"
            title={editingTenant ? "Editar inquilino" : "Adicionar inquilino"}
            onClose={() => { setDialogOpen(false); setEditingTenant(null); setSaveError(null); }}
          >
            {saveError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive mb-4">
                {saveError}
              </p>
            )}
            <TenantForm
              key={editingTenant?.id || "new"}
              tenant={editingTenant}
              properties={properties}
              onSave={handleSave}
              onCancel={() => { setDialogOpen(false); setEditingTenant(null); setSaveError(null); }}
            />
          </DialogContentWithClose>
        </Dialog>
      ),
    });
    return () => setPageHeader({ title: null, description: null, action: null });
  }, [setPageHeader, dialogOpen, editingTenant, handleSave, saveError, properties]);

  const getPropertyName = (propertyId) => {
    if (!propertyId) return "—";
    const p = properties.find((prop) => String(prop.id) === String(propertyId));
    return p?.name ?? propertyId;
  };

  const getUnitLabel = (tenantId) => {
    for (const prop of properties) {
      const units = prop.units || [];
      const unit = units.find(
        (u) =>
          String(u.residentTenantId) === String(tenantId) ||
          (Array.isArray(u.residentTenantIds) &&
            u.residentTenantIds.some((id) => String(id) === String(tenantId))) ||
          String(u.tenantId) === String(tenantId)
      );
      if (unit) return unit.unitLabel || "—";
    }
    return "—";
  };

  const filtered = tenants.filter(
    (t) =>
      !search ||
      t.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.kitnetNumber?.toString().includes(search) ||
      t.phone?.includes(search) ||
      getPropertyName(t.propertyId)?.toLowerCase().includes(search.toLowerCase())
  );

  const handleRemoveClick = (tenant) => setDeleteConfirm(tenant);

  const toggleGroup = (key) =>
    setExpandedGroups((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }));

  const isGroupExpanded = (key) => expandedGroups[key] !== false;

  // Group tenants by property
  const propertyGroups = (() => {
    const map = {};
    for (const tenant of filtered) {
      const key = tenant.propertyId ? String(tenant.propertyId) : "__none__";
      if (!map[key]) map[key] = [];
      map[key].push(tenant);
    }
    return Object.entries(map).sort(([a], [b]) => {
      if (a === "__none__") return 1;
      if (b === "__none__") return -1;
      return getPropertyName(a).localeCompare(getPropertyName(b));
    });
  })();
  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteTenant(deleteConfirm.id);
      setDeleteConfirm(null);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-lg border border-border">
        <CardHeader>
          <CardTitle>Listagem</CardTitle>
          <CardDescription>Todos os inquilinos cadastrados</CardDescription>
          <div className="relative mt-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, imóvel, kitnet ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {!loading && loadError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <p className="text-center text-muted-foreground">{loadError}</p>
              <Button variant="outline" onClick={() => load()}>
                Tentar novamente
              </Button>
            </div>
          ) : loading ? (
            <SkeletonTable rows={6} cols={6} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum inquilino encontrado"
              description={search ? "Tente outro termo de busca." : "Adicione o primeiro inquilino para começar."}
              action={
                !search && (
                  <Button
                    type="button"
                    onClick={() => {
                      setEditingTenant(null);
                      setSaveError(null);
                      setDialogOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar inquilino
                  </Button>
                )
              }
            />
          ) : (
          <div className="space-y-5">
            {propertyGroups.map(([key, groupTenants]) => {
              const prop = key !== "__none__" ? properties.find((p) => String(p.id) === key) : null;
              const propName = prop?.name ?? (key !== "__none__" ? key : "Sem imóvel vinculado");
              const propAddress = prop?.address || prop?.endereco || null;
              const activeCount = groupTenants.filter((t) => t.status === "ativo").length;
              const expanded = isGroupExpanded(key);

              return (
                <div key={key} className="overflow-hidden rounded-xl border border-border shadow-sm">
                  {/* Group header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(key)}
                    className="flex w-full flex-col items-start justify-between gap-3 bg-muted/50 px-4 py-3.5 text-left transition-colors hover:bg-muted/70 sm:flex-row sm:items-center sm:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight text-foreground">{propName}</p>
                        {propAddress && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {propAddress}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {groupTenants.length} inquilino{groupTenants.length !== 1 ? "s" : ""}
                      </span>
                      {activeCount > 0 && (
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          {activeCount} ativo{activeCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Group table */}
                  {expanded && (
                    <Table mobileCards>
                      <TableHeader>
                        <TableRow className="border-t border-border bg-background/50">
                          <TableHead className="w-10" aria-label="Expandir" />
                          <TableHead>Nome</TableHead>
                          <TableHead>Unidade</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Valor do aluguel</TableHead>
                          <TableHead>Data de entrada</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupTenants.map((tenant) => (
                          <Fragment key={tenant.id}>
                            <TableRow
                              className={cn(
                                "cursor-pointer transition-colors",
                                expandedId === tenant.id && "bg-muted/40"
                              )}
                              onClick={() => setExpandedId(expandedId === tenant.id ? null : tenant.id)}
                            >
                              <TableCell data-mobile-full="true" className="w-10 py-3 align-middle">
                                <span className="inline-flex text-muted-foreground">
                                  {expandedId === tenant.id ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </span>
                              </TableCell>
                              <TableCell data-mobile-primary="true" className="font-medium">{tenant.name}</TableCell>
                              <TableCell data-label="Unidade">{getUnitLabel(tenant.id)}</TableCell>
                              <TableCell data-label="Telefone">{tenant.phone || "-"}</TableCell>
                              <TableCell data-label="Aluguel">{formatCurrency(tenant.rentValue)}</TableCell>
                              <TableCell data-label="Entrada">{formatDate(tenant.startDate)}</TableCell>
                              <TableCell data-label="Status">
                                <Badge
                                  variant={tenant.status === "ativo" ? "success" : "secondary"}
                                  className={
                                    tenant.status === "ativo"
                                      ? "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300 border-emerald-500/30"
                                      : "bg-zinc-500/20 text-zinc-500 dark:bg-zinc-500/25 dark:text-zinc-400 border-zinc-500/30"
                                  }
                                >
                                  {tenant.status === "ativo" ? "Ativo" : "Saiu"}
                                </Badge>
                              </TableCell>
                              <TableCell data-mobile-actions="true" className="text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingTenant(tenant);
                                      setDialogOpen(true);
                                    }}
                                    title="Editar"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  {tenant.isPaymentResponsible ? (
                                    <Link href={`/pagamentos?tenantId=${tenant.id}`}>
                                      <Button variant="ghost" size="icon" title="Ver histórico">
                                        <History className="h-4 w-4" />
                                      </Button>
                                    </Link>
                                  ) : null}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveClick(tenant)}
                                    title="Remover"
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {expandedId === tenant.id && (
                              <TableRow data-mobile-detail="true" className="hover:bg-transparent">
                                <TableCell data-mobile-full="true" colSpan={9} className="border-t-0 bg-muted/20 p-0 align-top">
                                  <div className="rounded-b-lg border-x border-b border-border/50 px-5 py-4 shadow-inner">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                      Observações
                                    </p>
                                    <p className="mt-1.5 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                      {tenant.observacao || "Nenhuma observação cadastrada."}
                                    </p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Excluir inquilino"
        description={deleteConfirm ? `Tem certeza que deseja excluir "${deleteConfirm.name}"? Os pagamentos vinculados podem ser afetados.` : ""}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </div>
  );
}
