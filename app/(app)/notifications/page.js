"use client";

import { useEffect, useState, useCallback } from "react";
import { usePageHeader } from "@/context/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/api";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { NotificationPreferencesCard } from "@/components/notifications/NotificationPreferencesCard";
import { NOTIFICATION_TYPE_CONFIG } from "@/lib/notificationTypes";
import { Search, CheckCheck } from "lucide-react";

const TYPE_OPTIONS = [
  { value: "__all__", label: "Todos os tipos" },
  ...Object.entries(NOTIFICATION_TYPE_CONFIG)
    .filter(([k]) => k !== "default")
    .map(([value, config]) => ({ value, label: config.label })),
];

export default function NotificationsPage() {
  const { setPageHeader } = usePageHeader();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const limit = 10;
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (reset = true, appendFrom = 0) => {
    setLoading(true);
    const off = reset ? 0 : appendFrom;
    try {
      const params = { limit, offset: off, includeUnreadCount: true };
      if (filterType) params.type = filterType;
      if (search.trim()) params.search = search.trim();
      const res = await fetchNotifications(params);
      const list = res.notifications || [];
      if (reset) {
        setNotifications(list);
      } else {
        setNotifications((prev) => [...prev, ...list]);
      }
      setHasMore(list.length >= limit);
      if (res.unreadCount != null) setUnreadCount(res.unreadCount);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterType, search]);

  useEffect(() => {
    load(true);
  }, []);

  useEffect(() => {
    setPageHeader({
      title: "Notificações",
      description: "Histórico de alertas e eventos do sistema.",
    });
    return () => setPageHeader({ title: null, description: null, action: null });
  }, [setPageHeader]);

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <NotificationPreferencesCard />

      <Card className="rounded-xl border border-border shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <CardTitle className="text-base font-semibold">Filtros</CardTitle>
          <CardDescription>Busque e filtre por tipo ou palavra-chave</CardDescription>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou mensagem"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load(true)}
                onBlur={() => search && load(true)}
                className="pl-9"
              />
            </div>
            <Select value={filterType || "__all__"} onValueChange={(v) => setFilterType(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => load(true)} disabled={loading}>
              Aplicar
            </Button>
            {unreadCount > 0 && (
              <Button variant="secondary" size="sm" onClick={handleMarkAllRead}>
                <CheckCheck className="mr-2 h-4 w-4" />
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && notifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma notificação encontrada.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => (
                <li key={n.id}>
                  <NotificationItem
                    notification={n}
                    onMarkRead={handleMarkRead}
                    compact={false}
                  />
                </li>
              ))}
            </ul>
          )}
          {hasMore && notifications.length > 0 && (
            <div className="border-t border-border p-4 text-center">
              <Button variant="ghost" onClick={() => load(false, notifications.length)} disabled={loading}>
                Carregar mais
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
