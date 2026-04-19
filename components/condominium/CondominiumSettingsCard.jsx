"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { fetchCondominiumSettings, updateCondominiumSettings } from "@/lib/api";
import { Settings2 } from "lucide-react";

export function CondominiumSettingsCard({ onRefresh, propertyId }) {
  const [settings, setSettings] = useState(null);
  const [chargeWithRent, setChargeWithRent] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCondominiumSettings(propertyId)
      .then((data) => {
        if (!cancelled) {
          setSettings(data);
          setChargeWithRent(data?.chargeWithRent !== false);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [propertyId]);

  const handleToggle = async () => {
    const next = !chargeWithRent;
    setSaving(true);
    try {
      await updateCondominiumSettings({ chargeWithRent: next, propertyId });
      setChargeWithRent(next);
      onRefresh?.();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="overflow-hidden rounded-xl border border-[hsl(var(--condo-accent)/0.3)] shadow-sm">
      <CardHeader className="border-b border-[hsl(var(--condo-accent)/0.2)] bg-[hsl(var(--condo-accent)/0.06)]">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-[hsl(var(--condo-accent))]">
          <Settings2 className="h-4 w-4" />
          Integração com pagamentos
        </CardTitle>
        <CardDescription>
          Definir se o valor do condomínio aparece junto com o aluguel ou é cobrado separadamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm font-medium">Cobrança</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {chargeWithRent
                ? "Condomínio somado ao aluguel (uma única parcela)"
                : "Condomínio cobrado em separado"}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={chargeWithRent}
            disabled={saving}
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 ${
              chargeWithRent ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                chargeWithRent ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
