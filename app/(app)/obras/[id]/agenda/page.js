"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, startOfDay, endOfDay, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContentWithClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import {
  fetchObraAgenda,
  fetchObraStages,
  fetchObraWorkers,
  fetchObraStageWorkers,
  createObraAgendaItem,
  updateObraAgendaItem,
  deleteObraAgendaItem,
} from "@/lib/api";
import { ObraAgendaForm } from "@/components/forms/obra-agenda-form";
import { CalendarToolbar } from "@/components/calendar/CalendarToolbar";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const localizer = dateFnsLocalizer({
  format,
  startOfWeek: () => startOfWeek(new Date(), { locale: ptBR }),
  getDay,
  locales: { "pt-BR": ptBR },
});

const STATUS_COLORS = {
  Pendente: "#ef4444",
  "Em andamento": "#f59e0b",
  Concluído: "#10b981",
};

const STATUS_BADGE_CLASS = {
  Pendente: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  "Em andamento": "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  Concluído: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};

function buildCalendarEvents(agendaItems, stages, stageWorkers = [], workers = []) {
  const workersByStage = {};
  (stageWorkers || []).forEach((sw) => {
    if (!workersByStage[sw.stageId]) workersByStage[sw.stageId] = [];
    const w = workers.find((x) => x.id === sw.workerId);
    if (w) workersByStage[sw.stageId].push(w.name);
  });

  const events = [];
  (agendaItems || []).forEach((item) => {
    const d = item.date ? new Date(item.date) : null;
    if (!d || isNaN(d.getTime())) return;
    events.push({
      start: startOfDay(d),
      end: endOfDay(d),
      title: item.activity || "Atividade",
      type: "agenda",
      id: item.id,
      ...item,
    });
  });
  (stages || []).forEach((stage) => {
    const d = stage.startDate ? new Date(stage.startDate) : null;
    if (!d || isNaN(d.getTime())) return;
    const workerNames = workersByStage[stage.id] || [];
    const titleSuffix = workerNames.length > 0 ? ` – ${workerNames.join(", ")}` : "";
    events.push({
      start: startOfDay(d),
      end: endOfDay(d),
      title: (stage.name || "Etapa") + titleSuffix,
      type: "stage",
      id: stage.id,
      status: stage.status || "Pendente",
      responsible: stage.responsible,
      workerNames,
      ...stage,
    });
  });
  return events;
}

function eventsForDate(events, date) {
  const d = startOfDay(date);
  return events.filter((e) => {
    const start = new Date(e.start);
    return start.getTime() === d.getTime();
  });
}

export default function ObraAgendaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const [agendaItems, setAgendaItems] = useState([]);
  const [stages, setStages] = useState([]);
  const [stageWorkers, setStageWorkers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState("month");
  const [dayModal, setDayModal] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDate, setCreateDate] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [agenda, stagesData, stageWorkersData, workersData] = await Promise.all([
        fetchObraAgenda(id),
        fetchObraStages(id),
        fetchObraStageWorkers(id),
        fetchObraWorkers(id),
      ]);
      setAgendaItems(Array.isArray(agenda) ? agenda : []);
      setStages(Array.isArray(stagesData) ? stagesData : []);
      setStageWorkers(Array.isArray(stageWorkersData) ? stageWorkersData : []);
      setWorkers(Array.isArray(workersData) ? workersData : []);
    } catch (e) {
      console.error(e);
      setAgendaItems([]);
      setStages([]);
      setStageWorkers([]);
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const events = useMemo(
    () => buildCalendarEvents(agendaItems, stages, stageWorkers, workers),
    [agendaItems, stages, stageWorkers, workers]
  );

  const handleSelectSlot = useCallback(({ start }) => {
    setCreateDate(start);
    setEditingItem(null);
    setCreateModalOpen(true);
  }, []);

  const handleSelectEvent = useCallback(
    (event) => {
      const dayEvents = eventsForDate(events, event.start);
      setDayModal({ date: event.start, events: dayEvents });
    },
    [events]
  );

  const handleSaveAgenda = useCallback(
    async (payload) => {
      if (!id) return;
      setSaveError(null);
      setSaving(true);
      try {
        if (editingItem && editingItem.type === "agenda") {
          await updateObraAgendaItem(id, editingItem.id, payload);
        } else {
          await createObraAgendaItem(id, {
            ...payload,
            date: createDate
              ? format(createDate, "yyyy-MM-dd")
              : payload.date,
          });
        }
        setCreateModalOpen(false);
        setEditingItem(null);
        setCreateDate(null);
        await load();
      } catch (e) {
        console.error(e);
        setSaveError(e?.message || "Erro ao salvar.");
      } finally {
        setSaving(false);
      }
    },
    [id, editingItem, createDate, load]
  );

  const handleDeleteAgenda = useCallback(
    async (itemId) => {
      if (!id || !confirm("Excluir este item da agenda?")) return;
      try {
        await deleteObraAgendaItem(id, itemId);
        setDayModal(null);
        await load();
      } catch (e) {
        console.error(e);
        alert(e?.message || "Erro ao excluir.");
      }
    },
    [id, load]
  );

  const eventPropGetter = useCallback((event) => {
    if (event.type === "stage" && event.status) {
      const color = STATUS_COLORS[event.status] || STATUS_COLORS.Pendente;
      return {
        style: {
          backgroundColor: color,
          color: "#fff",
          border: "none",
          borderRadius: "4px",
        },
      };
    }
    return {
      style: {
        backgroundColor: "hsl(var(--primary))",
        color: "hsl(var(--primary-foreground))",
        border: "none",
        borderRadius: "4px",
      },
    };
  }, []);

  if (!id) return null;

  return (
    <div className="space-y-6">
      <Card className="rounded-lg border border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Agenda da obra</CardTitle>
          <CardDescription>
            Calendário com eventos da agenda e etapas. Clique em um dia vazio para criar evento; clique em um evento para ver o dia.
          </CardDescription>
          <div className="mt-4 flex flex-wrap gap-2">
            <Dialog
              open={createModalOpen}
              onOpenChange={(o) => {
                setCreateModalOpen(o);
                if (!o) {
                  setEditingItem(null);
                  setCreateDate(null);
                  setSaveError(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingItem(null); setCreateDate(new Date()); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova atividade
                </Button>
              </DialogTrigger>
              <DialogContentWithClose
                title={editingItem ? "Editar atividade" : "Nova atividade"}
                onClose={() => {
                  setCreateModalOpen(false);
                  setEditingItem(null);
                  setSaveError(null);
                }}
              >
                {saveError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {saveError}
                  </p>
                )}
                <ObraAgendaForm
                  item={
                    editingItem && editingItem.type === "agenda"
                      ? editingItem
                      : createDate
                        ? { date: format(createDate, "yyyy-MM-dd"), activity: "", responsible: "", notes: "" }
                        : null
                  }
                  onSave={handleSaveAgenda}
                  onCancel={() => {
                    setCreateModalOpen(false);
                    setEditingItem(null);
                    setSaveError(null);
                  }}
                  saving={saving}
                />
              </DialogContentWithClose>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-12 text-center text-muted-foreground">Carregando...</p>
          ) : (
            <div className="h-[560px] overflow-x-auto rounded-lg border border-border bg-card sm:h-[600px] [&_.rbc-calendar]:font-sans [&_.rbc-calendar>.calendar-toolbar]:w-full [&_.rbc-header]:border-border [&_.rbc-month-view]:border-border [&_.rbc-off-range-bg]:bg-muted/30 [&_.rbc-today]:bg-primary/5 [&_.rbc-event]:py-0.5">
              <div className="h-full min-w-[640px]">
                <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                titleAccessor="title"
                date={date}
                onNavigate={setDate}
                view={view}
                onView={setView}
                views={["month", "agenda"]}
                components={{ toolbar: CalendarToolbar }}
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                selectable
                eventPropGetter={eventPropGetter}
                culture="pt-BR"
                messages={{
                  date: "Data",
                  time: "Hora",
                  event: "Evento",
                  noEventsInRange: "Nenhum evento neste período.",
                }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: eventos do dia */}
      {dayModal && (
        <Dialog
          open={!!dayModal}
          onOpenChange={(open) => !open && setDayModal(null)}
        >
          <DialogContentWithClose
            title={format(dayModal.date, "d 'de' MMMM", { locale: ptBR })}
            onClose={() => setDayModal(null)}
          >
            <div className="mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreateDate(dayModal.date);
                  setEditingItem(null);
                  setDayModal(null);
                  setCreateModalOpen(true);
                }}
              >
                <Plus className="mr-2 h-3 w-3" />
                Nova atividade neste dia
              </Button>
            </div>
            <ul className="space-y-3">
              {dayModal.events.length === 0 ? (
                <li className="text-sm text-muted-foreground">Nenhum evento neste dia.</li>
              ) : (
                dayModal.events.map((ev) => (
                  <li
                    key={ev.type === "stage" ? `s-${ev.id}` : `a-${ev.id}`}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3"
                  >
                    {ev.type === "stage" ? (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{ev.name || ev.title}</span>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-xs font-medium",
                              STATUS_BADGE_CLASS[ev.status] || STATUS_BADGE_CLASS.Pendente
                            )}
                          >
                            {ev.status}
                          </span>
                        </div>
                        {(ev.workerNames && ev.workerNames.length > 0) && (
                          <p className="text-sm text-muted-foreground">Trabalhadores: {ev.workerNames.join(", ")}</p>
                        )}
                        {ev.responsible && (
                          <p className="text-sm text-muted-foreground">Responsável: {ev.responsible}</p>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-fit"
                          onClick={() => {
                            setDayModal(null);
                            router.push(`/obras/${id}/etapas`);
                          }}
                        >
                          <ExternalLink className="mr-2 h-3 w-3" />
                          Ir para etapa
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{ev.title}</span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setDayModal(null);
                                setEditingItem(ev);
                                setCreateModalOpen(true);
                              }}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteAgenda(ev.id)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {(ev.responsible || ev.notes) && (
                          <p className="text-sm text-muted-foreground">
                            {ev.responsible && `Responsável: ${ev.responsible}`}
                            {ev.responsible && ev.notes && " · "}
                            {ev.notes}
                          </p>
                        )}
                      </>
                    )}
                  </li>
                ))
              )}
            </ul>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setDayModal(null)}>
                Fechar
              </Button>
            </div>
          </DialogContentWithClose>
        </Dialog>
      )}
    </div>
  );
}
