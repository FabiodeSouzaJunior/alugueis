"use client";
// Avaliação dos moradores (moradores/tenant feedback)

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { StarRating } from "@/components/avaliacao/StarRating";
import { FeedbackCategories } from "@/components/avaliacao/FeedbackCategories";
import { fetchAvaliacaoKitnets, fetchTenants, submitAvaliacao } from "@/lib/api";
import { cn } from "@/lib/utils";

const RATING_FIELDS = [
  { key: "comfortRating", label: "Conforto" },
  { key: "cleanlinessRating", label: "Limpeza" },
  { key: "infrastructureRating", label: "Infraestrutura" },
  { key: "locationRating", label: "Localização" },
  { key: "costBenefitRating", label: "Custo-benefício" },
];

const DEFAULT_RATINGS = {
  comfortRating: 0,
  cleanlinessRating: 0,
  infrastructureRating: 0,
  locationRating: 0,
  costBenefitRating: 0,
  overallRating: 0,
};

function safeRatingOrNull(v) {
  const n = Number(v);
  return !Number.isFinite(n) || n <= 0 ? null : n;
}

export default function AvaliacaoPage() {
  const [kitnets, setKitnets] = useState([]);
  const [tenantByKitnet, setTenantByKitnet] = useState({});
  const [selectedKitnet, setSelectedKitnet] = useState("");

  const [ratings, setRatings] = useState(DEFAULT_RATINGS);
  const [recommendation, setRecommendation] = useState("");
  const [comment, setComment] = useState("");
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedTenant = tenantByKitnet[selectedKitnet] || null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const [kitnetsRes, tenantsRes] = await Promise.all([
        fetchAvaliacaoKitnets(),
        fetchTenants(),
      ]);

      const kitnetList = Array.isArray(kitnetsRes) ? kitnetsRes : [];
      const tenants = Array.isArray(tenantsRes) ? tenantsRes : [];
      const activeTenants = tenants.filter((t) => (t.status || "").toLowerCase() === "ativo");

      const map = {};
      activeTenants.forEach((t) => {
        if (!t.kitnetNumber) return;
        map[String(t.kitnetNumber)] = t;
      });

      setKitnets(kitnetList);
      setTenantByKitnet(map);
      setSelectedKitnet((prev) => prev || (kitnetList[0] != null ? String(kitnetList[0]) : ""));
    } catch (e) {
      console.error(e);
      setError(e?.message || "Erro ao carregar avaliação.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const canSubmit = useMemo(() => {
    return !!selectedTenant && safeRatingOrNull(ratings.overallRating) != null;
  }, [selectedTenant, ratings.overallRating]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);
      if (!selectedTenant) {
        setError("Selecione um inquilino/kitnet válido.");
        return;
      }
      if (safeRatingOrNull(ratings.overallRating) == null) {
        setError("Selecione a nota geral (1 a 5).");
        return;
      }

      setSubmitting(true);
      try {
        const payload = {
          tenantName: selectedTenant.name,
          contact: selectedTenant.phone ?? null,
          kitnetNumber: selectedTenant.kitnetNumber ?? selectedKitnet,
          comfortRating: safeRatingOrNull(ratings.comfortRating),
          cleanlinessRating: safeRatingOrNull(ratings.cleanlinessRating),
          infrastructureRating: safeRatingOrNull(ratings.infrastructureRating),
          locationRating: safeRatingOrNull(ratings.locationRating),
          costBenefitRating: safeRatingOrNull(ratings.costBenefitRating),
          overallRating: safeRatingOrNull(ratings.overallRating),
          recommendation: recommendation.trim() ? recommendation.trim() : null,
          comment: comment.trim() ? comment.trim() : null,
          categories,
        };

        const res = await submitAvaliacao(payload);
        setSuccess(res?.message || "Obrigado! Sua avaliação foi registrada.");
        setRatings(DEFAULT_RATINGS);
        setRecommendation("");
        setComment("");
        setCategories([]);
      } catch (e2) {
        console.error(e2);
        setError(e2?.message || "Erro ao enviar avaliação.");
      } finally {
        setSubmitting(false);
      }
    },
    [selectedTenant, selectedKitnet, ratings, recommendation, comment, categories]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl py-10">
        <p className="text-sm text-muted-foreground">Carregando avaliação...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-8">
      <Card className="shadow-sm">
        <CardHeader className="pb-5">
          <CardTitle className="text-2xl">Avaliação</CardTitle>
          <CardDescription>
            Sua avaliação ajuda a melhorar a experiência. Campos opcionais podem ser deixados em branco.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-2">
          <Label>Unidade</Label>
          <select
            value={selectedKitnet}
            onChange={(e) => setSelectedKitnet(e.target.value)}
            className={cn(
              "h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm",
              !selectedTenant && "border-destructive/40"
            )}
          >
            {kitnets.map((k) => (
              <option key={k} value={String(k)}>
                {k}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {selectedTenant ? `Inquilino: ${selectedTenant.name}` : "Selecione uma unidade com inquilino ativo."}
          </p>
        </div>

        <div className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4">
          <h2 className="text-sm font-semibold">Notas (1 a 5)</h2>
          {RATING_FIELDS.map((f) => (
            <StarRating
              key={f.key}
              label={f.label}
              value={ratings[f.key]}
              onChange={(v) => setRatings((p) => ({ ...p, [f.key]: v }))}
              disabled={!selectedTenant}
            />
          ))}

          <div className="pt-2">
            <StarRating
              label="Nota geral"
              value={ratings.overallRating}
              onChange={(v) => setRatings((p) => ({ ...p, overallRating: v }))}
              disabled={!selectedTenant}
            />
          </div>
        </div>

        <FeedbackCategories
          selected={categories}
          onChange={setCategories}
          disabled={!selectedTenant}
        />

        <div className="grid gap-2">
          <Label>Recomendação (opcional)</Label>
          <Input
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            placeholder="Ex.: ampliar manutenção, melhorar limpeza, etc."
          />
        </div>

        <div className="grid gap-2">
          <Label>Comentário (opcional)</Label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Escreva um comentário adicional..."
            className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={!canSubmit || submitting}>
            {submitting ? "Enviando..." : "Enviar avaliação"}
          </Button>
        </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
