"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { fetchNotificationPreferences, updateNotificationPreferences } from "@/lib/api";
import { NOTIFICATION_PREFERENCE_KEYS } from "@/lib/notificationPreferences";
import { Bell, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function NotificationPreferencesCard() {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchNotificationPreferences();
      setPreferences(res.preferences || {});
    } catch (e) {
      console.error(e);
      setPreferences({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = useCallback(async (key, checked) => {
    if (!preferences) return;
    setUpdatingKey(key);
    try {
      const next = { ...preferences, [key]: checked };
      await updateNotificationPreferences({ [key]: checked });
      setPreferences(next);
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingKey(null);
    }
  }, [preferences]);

  return (
    <Card className="rounded-xl border border-border shadow-sm">
      <CardHeader className={cn("border-b border-border/50 bg-muted/20")}>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">Preferências de Notificação</CardTitle>
        </div>
        <CardDescription>
          Escolha quais eventos devem gerar notificação. Quando ligado, você recebe; quando desligado, não.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando preferências…</span>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {NOTIFICATION_PREFERENCE_KEYS.map(({ key, label }) => {
              const checked = preferences?.[key] !== false;
              const isUpdating = updatingKey === key;
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/30"
                >
                  <Label
                    htmlFor={`pref-${key}`}
                    className="flex-1 cursor-pointer text-sm font-medium leading-tight text-foreground"
                  >
                    {label}
                  </Label>
                  <div className="flex items-center gap-2">
                    {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <Switch
                      id={`pref-${key}`}
                      checked={checked}
                      onCheckedChange={(v) => handleToggle(key, v)}
                      disabled={isUpdating}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
