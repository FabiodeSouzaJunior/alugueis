/**
 * Tipos de notificação: cor e ícone para a UI.
 * Cores: green (pagamentos recebidos), yellow (pendências), red (atrasos/problemas), blue (info), purple (obra).
 */
import {
  CreditCard,
  AlertCircle,
  Clock,
  UserPlus,
  UserMinus,
  Star,
  MessageSquare,
  HardHat,
  TrendingUp,
  Wrench,
  Info,
  Bell,
} from "lucide-react";

export const NOTIFICATION_TYPE_CONFIG = {
  // Pagamentos
  payment_received: { color: "green", icon: CreditCard, label: "Pagamento" },
  payment_overdue: { color: "red", icon: AlertCircle, label: "Atraso" },
  payment_pending_due: { color: "yellow", icon: Clock, label: "Pendente" },
  tenant_multiple_overdue: { color: "red", icon: AlertCircle, label: "Inadimplência" },
  payment_high_value: { color: "green", icon: CreditCard, label: "Recebimento" },
  // Inquilinos
  tenant_created: { color: "blue", icon: UserPlus, label: "Inquilino" },
  tenant_exit: { color: "blue", icon: UserMinus, label: "Saída" },
  contract_near_end: { color: "yellow", icon: Clock, label: "Contrato" },
  // Satisfação
  satisfaction_new: { color: "blue", icon: Star, label: "Avaliação" },
  satisfaction_low: { color: "red", icon: Star, label: "Satisfação baixa" },
  feedback_new: { color: "blue", icon: MessageSquare, label: "Feedback" },
  // Obra
  obra_stage_completed: { color: "purple", icon: HardHat, label: "Obra" },
  obra_expense_added: { color: "purple", icon: HardHat, label: "Obra" },
  obra_budget_exceeded: { color: "red", icon: AlertCircle, label: "Obra" },
  obra_deadline_near: { color: "yellow", icon: Clock, label: "Obra" },
  // Financeiro
  expense_added: { color: "blue", icon: TrendingUp, label: "Despesa" },
  maintenance_added: { color: "blue", icon: Wrench, label: "Manutenção" },
  // Alertas
  high_vacancy: { color: "yellow", icon: Info, label: "Vacância" },
  high_overdue: { color: "red", icon: AlertCircle, label: "Inadimplência" },
  satisfaction_drop: { color: "red", icon: Star, label: "Satisfação" },
  high_demand: { color: "green", icon: TrendingUp, label: "Demanda" },
  default: { color: "blue", icon: Bell, label: "Notificação" },
};

export function getNotificationConfig(type) {
  return NOTIFICATION_TYPE_CONFIG[type] || NOTIFICATION_TYPE_CONFIG.default;
}
