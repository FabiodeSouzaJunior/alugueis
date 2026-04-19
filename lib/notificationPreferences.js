/**
 * Chaves e labels para preferências de notificação (toggles na página de notificações).
 * Cada chave corresponde a um tipo de notificação; quando desligado, o admin não recebe.
 */
export const NOTIFICATION_PREFERENCE_KEYS = [
  { key: "payment_overdue", label: "Inquilino com aluguel atrasado" },
  { key: "payment_received", label: "Pagamento de aluguel recebido" },
  { key: "tenant_created", label: "Novo contrato criado" },
  { key: "tenant_exit", label: "Contrato encerrado" },
  { key: "satisfaction_new", label: "Nova avaliação de cliente" },
  { key: "satisfaction_low", label: "Nota baixa de satisfação" },
  { key: "feedback_new", label: "Novo feedback de morador" },
  { key: "maintenance_added", label: "Nova manutenção registrada" },
  { key: "obra_stage_completed", label: "Etapa de obra concluída" },
  { key: "consumption_spike", label: "Aumento anormal de consumo de água ou luz" },
];

const ENABLED_BY_DEFAULT = new Set([
  "payment_overdue",
  "payment_received",
  "tenant_exit",
  "maintenance_added",
]);

export const DEFAULT_PREFERENCES = Object.fromEntries(
  NOTIFICATION_PREFERENCE_KEYS.map(({ key }) => [key, ENABLED_BY_DEFAULT.has(key)])
);
