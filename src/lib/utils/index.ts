import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type {
  UserRole,
  ClientStatus,
  ProjectStatus,
  ProjectPhase,
  ActionStatus,
  ActionPriority,
  ActionClassification,
  MeetingType,
  DocumentCategory,
  DocumentStatus,
  DocumentVisibility,
  DiagnosisStatus,
  KpiClassification,
  KpiFrequency,
  KpiOriginType,
  KpiPeriodRecordStatus,
  KpiReadingType,
  KpiStatus,
  KpiTrend,
  FspMethodType,
  FspSourceType,
  FspStatus,
  PerformanceStatus,
  StrategicFocus,
} from '@/types/database.types'

// Merge de classes Tailwind sem conflito
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Labels de exibição ────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  admin_faus:      'Admin FAUS',
  gestor_faus:     'Gestor FAUS',
  consultor_faus:  'Consultor FAUS',
  cliente:         'Cliente',
}

export const INTERNAL_ROLES: UserRole[] = ['admin_faus', 'gestor_faus', 'consultor_faus']
export const ALL_PROJECTS_ROLES: UserRole[] = ['admin_faus', 'gestor_faus']

export function isAdminRole(role: UserRole) {
  return role === 'admin_faus'
}

export function isInternalRole(role: UserRole) {
  return INTERNAL_ROLES.includes(role)
}

export function canViewAllProjects(role: UserRole) {
  return ALL_PROJECTS_ROLES.includes(role)
}

export function canManageUsers(role: UserRole) {
  return role === 'admin_faus'
}

export function canAccessDashboard(role: UserRole) {
  return isInternalRole(role)
}

export function canAccessPortal(role: UserRole) {
  return role === 'cliente'
}

export function canAccessInternalReports(role: UserRole) {
  return isInternalRole(role)
}

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: 'Não Iniciado',
  in_progress: 'Em Andamento',
  at_risk:     'Em Atenção',
  delayed:     'Atrasado',
  completed:   'Concluído',
  suspended:   'Suspenso',
  cancelled:   'Cancelado',
}

export const PROJECT_PHASE_LABELS: Record<ProjectPhase, string> = {
  initial_deployment: 'Implantação Inicial',
  diagnosis:          'Diagnóstico',
  planning:           'Planejamento',
  execution:          'Execução',
  monitoring:         'Acompanhamento',
  consolidation:      'Consolidação',
  closed:             'Encerrado',
}

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  not_started:    'Não Iniciada',
  in_progress:    'Em Andamento',
  waiting_client: 'Aguardando Cliente',
  waiting_faus:   'Aguardando FAUS',
  completed:      'Concluída',
  overdue:        'Atrasada',
  cancelled:      'Cancelada',
}

export const ACTION_PRIORITY_LABELS: Record<ActionPriority, string> = {
  low:      'Baixa',
  medium:   'Média',
  high:     'Alta',
  critical: 'Crítica',
}

export const ACTION_CLASSIFICATION_LABELS: Record<ActionClassification, string> = {
  strategic: 'Estratégica',
  complementary: 'Complementar',
  operational_support: 'Suporte Operacional',
  out_of_scope: 'Fora de Escopo',
}

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  kickoff: 'Kick-off',
  followup: 'Follow-up',
  executive: 'Reunião Executiva',
  operational: 'Reunião Operacional',
  kpi_review: 'Análise de Indicadores',
  closure: 'Encerramento',
  extraordinary: 'Extraordinária',
}

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  meeting_minutes: 'Ata de Reunião',
  executive_report: 'Relatório Executivo',
  diagnosis: 'Diagnóstico',
  action_plan: 'Plano de Ação',
  presentation: 'Apresentação',
  kpi_indicator: 'Indicador / KPI',
  sop_procedure: 'SOP / Procedimento',
  technical_doc: 'Documento Técnico',
  support_doc: 'Documento de Apoio',
  other: 'Outro',
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  obsolete: 'Obsoleto',
  archived: 'Arquivado',
}

export const DOCUMENT_VISIBILITY_LABELS: Record<DocumentVisibility, string> = {
  internal: 'Interno',
  client_and_faus: 'Cliente + FAUS',
}

export const DIAGNOSIS_STATUS_LABELS: Record<DiagnosisStatus, string> = {
  em_elaboracao: 'Em elaboração',
  concluido: 'Concluído',
  revisado: 'Revisado',
}

export const KPI_ORIGIN_TYPE_LABELS: Record<KpiOriginType, string> = {
  diagnostic: 'Diagnóstico',
  project_defined: 'Definido no projeto',
  operational_unfolding: 'Desdobramento operacional',
  other: 'Outro',
}

export const KPI_READING_TYPE_LABELS: Record<KpiReadingType, string> = {
  higher_is_better: 'Maior é melhor',
  lower_is_better: 'Menor é melhor',
  exact_target: 'Alvo exato',
}

export const KPI_CLASSIFICATION_LABELS: Record<KpiClassification, string> = {
  primary: 'Primário',
  complementary: 'Complementar',
}

export const KPI_FREQUENCY_LABELS: Record<KpiFrequency, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  annual: 'Anual',
}

export const KPI_STATUS_LABELS: Record<KpiStatus, string> = {
  no_update:    'Sem Atualização',
  updated:      'Atualizado',
  at_risk:      'Em Risco',
  below_target: 'Fora da Meta',
  on_target:    'Dentro da Meta',
  above_target: 'Acima da Meta',
  inactive:     'Inativo',
}

export const KPI_TREND_LABELS: Record<KpiTrend, string> = {
  improving: 'Melhorando',
  stable:    'Estável',
  worsening: 'Piorando',
}

export const PERFORMANCE_STATUS_LABELS: Record<PerformanceStatus, string> = {
  green: 'Verde',
  yellow: 'Amarelo',
  red: 'Vermelho',
}

export const KPI_PERIOD_RECORD_STATUS_LABELS: Record<KpiPeriodRecordStatus, string> = {
  aberto: 'Aberto',
  fechado: 'Fechado',
  revisado: 'Revisado',
}

export const FSP_SOURCE_TYPE_LABELS: Record<FspSourceType, string> = {
  kpi_period: 'KPI / Período',
  action: 'Ação',
}

export const FSP_METHOD_TYPE_LABELS: Record<FspMethodType, string> = {
  five_whys: '5 Porquês',
  ishikawa: 'Ishikawa',
  structured_analysis: 'Análise Estruturada',
}

export const FSP_STATUS_LABELS: Record<FspStatus, string> = {
  aberta: 'Aberta',
  em_analise: 'Em análise',
  concluida: 'Concluída',
  convertida_em_acao: 'Convertida em ação',
}

export const STRATEGIC_FOCUS_LABELS: Record<StrategicFocus, string> = {
  transportes:               'Transportes',
  armazem:                   'Armazém',
  estoques:                  'Estoques',
  planejamento:              'Planejamento',
  planejamento_estrategico:  'Planejamento Estratégico',
  compras:                   'Compras',
  supply_chain_integrado:    'Supply Chain Integrado',
  processos:                 'Processos',
  indicadores_e_gestao:      'Indicadores e Gestão',
  sop_soe:                   'S&OP / S&OE',
  layout_e_enderecamento:    'Layout e Endereçamento',
  produtividade_operacional: 'Produtividade Operacional',
  comercial:                 'Comercial',
}

// ── Cores de status ───────────────────────────────────────────────────────────

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  not_started: 'bg-neutral-100 text-neutral-600',
  in_progress: 'bg-blue-50 text-blue-700',
  at_risk:     'bg-yellow-50 text-yellow-700',
  delayed:     'bg-red-50 text-red-700',
  completed:   'bg-green-50 text-green-700',
  suspended:   'bg-purple-50 text-purple-700',
  cancelled:   'bg-neutral-100 text-neutral-500',
}

export const CLIENT_STATUS_COLORS: Record<ClientStatus, string> = {
  active: 'bg-green-50 text-green-700',
  inactive: 'bg-neutral-100 text-neutral-500',
}

export const ACTION_PRIORITY_COLORS: Record<ActionPriority, string> = {
  low:      'bg-neutral-100 text-neutral-600',
  medium:   'bg-blue-50 text-blue-700',
  high:     'bg-orange-50 text-orange-700',
  critical: 'bg-red-50 text-red-700',
}

export const ACTION_STATUS_COLORS: Record<ActionStatus, string> = {
  not_started: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
  in_progress: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  waiting_client: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  waiting_faus: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200',
  completed: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200',
  overdue: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  cancelled: 'bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-300',
}

export const ACTION_STATUS_CARD_COLORS: Record<ActionStatus, string> = {
  not_started: 'border-l-slate-300 bg-slate-50/30',
  in_progress: 'border-l-blue-500 bg-blue-50/30',
  waiting_client: 'border-l-amber-500 bg-amber-50/30',
  waiting_faus: 'border-l-violet-500 bg-violet-50/30',
  completed: 'border-l-green-500 bg-green-50/30',
  overdue: 'border-l-red-500 bg-red-50/30',
  cancelled: 'border-l-neutral-400 bg-neutral-50',
}

export const ACTION_STATUS_ROW_COLORS: Record<ActionStatus, string> = {
  not_started: 'border-l-slate-300',
  in_progress: 'border-l-blue-500 bg-blue-50/20',
  waiting_client: 'border-l-amber-500 bg-amber-50/20',
  waiting_faus: 'border-l-violet-500 bg-violet-50/20',
  completed: 'border-l-green-500 bg-green-50/20',
  overdue: 'border-l-red-500 bg-red-50/20',
  cancelled: 'border-l-neutral-400 bg-neutral-50/70',
}

export const ACTION_STATUS_PROGRESS_COLORS: Record<ActionStatus, string> = {
  not_started: 'bg-slate-400',
  in_progress: 'bg-blue-600',
  waiting_client: 'bg-amber-500',
  waiting_faus: 'bg-violet-500',
  completed: 'bg-green-600',
  overdue: 'bg-red-600',
  cancelled: 'bg-neutral-500',
}

export const MEETING_TYPE_COLORS: Record<MeetingType, string> = {
  kickoff: 'bg-sky-50 text-sky-700',
  followup: 'bg-blue-50 text-blue-700',
  executive: 'bg-indigo-50 text-indigo-700',
  operational: 'bg-slate-100 text-slate-700',
  kpi_review: 'bg-emerald-50 text-emerald-700',
  closure: 'bg-green-50 text-green-700',
  extraordinary: 'bg-orange-50 text-orange-700',
}

export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: 'bg-neutral-100 text-neutral-600',
  published: 'bg-blue-50 text-blue-700',
  obsolete: 'bg-amber-50 text-amber-700',
  archived: 'bg-neutral-100 text-neutral-500',
}

export const DOCUMENT_VISIBILITY_COLORS: Record<DocumentVisibility, string> = {
  internal: 'bg-neutral-100 text-neutral-600',
  client_and_faus: 'bg-blue-50 text-blue-700',
}

export const DIAGNOSIS_STATUS_COLORS: Record<DiagnosisStatus, string> = {
  em_elaboracao: 'bg-amber-50 text-amber-700',
  concluido: 'bg-green-50 text-green-700',
  revisado: 'bg-blue-50 text-blue-700',
}

export const KPI_TREND_COLORS: Record<KpiTrend, string> = {
  improving: 'bg-green-50 text-green-700',
  stable: 'bg-neutral-100 text-neutral-600',
  worsening: 'bg-red-50 text-red-700',
}

export const KPI_STATUS_COLORS: Record<KpiStatus, string> = {
  no_update:    'bg-neutral-100 text-neutral-500',
  updated:      'bg-blue-50 text-blue-700',
  at_risk:      'bg-yellow-50 text-yellow-700',
  below_target: 'bg-red-50 text-red-700',
  on_target:    'bg-green-50 text-green-700',
  above_target: 'bg-emerald-50 text-emerald-700',
  inactive:     'bg-neutral-100 text-neutral-400',
}

export const PERFORMANCE_STATUS_COLORS: Record<PerformanceStatus, string> = {
  green: 'bg-green-50 text-green-700',
  yellow: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
}

export const KPI_PERIOD_RECORD_STATUS_COLORS: Record<KpiPeriodRecordStatus, string> = {
  aberto: 'bg-blue-50 text-blue-700',
  fechado: 'bg-neutral-100 text-neutral-600',
  revisado: 'bg-purple-50 text-purple-700',
}

export const FSP_STATUS_COLORS: Record<FspStatus, string> = {
  aberta: 'bg-amber-50 text-amber-700',
  em_analise: 'bg-blue-50 text-blue-700',
  concluida: 'bg-green-50 text-green-700',
  convertida_em_acao: 'bg-violet-50 text-violet-700',
}

export const DIAGNOSIS_AREA_OPTIONS = [
  'Transporte',
  'Armazém',
  'Compras',
  'Comercial',
  'Financeiro',
  'Logística',
] as const

export const DIAGNOSIS_UNIT_OPTIONS = [
  '%',
  'R$',
  'un',
  'dias',
  'horas',
  'min',
  'kg',
  'ton',
  'm³',
  'km',
  'pedidos',
  'entregas',
  'caixas',
] as const

export const KPI_MONTH_OPTIONS = [
  { index: 0, label: 'jan' },
  { index: 1, label: 'fev' },
  { index: 2, label: 'mar' },
  { index: 3, label: 'abr' },
  { index: 4, label: 'mai' },
  { index: 5, label: 'jun' },
  { index: 6, label: 'jul' },
  { index: 7, label: 'ago' },
  { index: 8, label: 'set' },
  { index: 9, label: 'out' },
  { index: 10, label: 'nov' },
  { index: 11, label: 'dez' },
] as const

// ── Formatadores ──────────────────────────────────────────────────────────────

function formatDecimalValue(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatRelativeDate(date: string | null | undefined): string {
  if (!date) return '—'
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
  const diff = (new Date(date).getTime() - Date.now()) / 1000
  if (Math.abs(diff) < 60)     return rtf.format(Math.round(diff), 'second')
  if (Math.abs(diff) < 3600)   return rtf.format(Math.round(diff / 60), 'minute')
  if (Math.abs(diff) < 86400)  return rtf.format(Math.round(diff / 3600), 'hour')
  if (Math.abs(diff) < 604800) return rtf.format(Math.round(diff / 86400), 'day')
  return formatDate(date)
}

export function formatMeasurementValue(
  value: number | null | undefined,
  unit: string | null | undefined
): string {
  if (value === null || value === undefined) return '—'

  if (unit === 'R$') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formattedNumber = formatDecimalValue(value)

  if (!unit) return formattedNumber
  if (unit === '%') return `${formattedNumber}%`
  if (unit === 'horas') return `${formattedNumber} h`

  return `${formattedNumber} ${unit}`
}

export function formatPercentageValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${formatDecimalValue(value)}%`
}

interface KpiPerformanceInput {
  readingType: KpiReadingType
  plannedTarget: number
  greenThreshold: number
  yellowThreshold: number
  redThreshold: number
  actualValue: number
}

interface KpiPerformanceResult {
  status: PerformanceStatus
  absoluteDeviation: number
  percentageDeviation: number | null
}

export function calculateKpiPerformance({
  readingType,
  plannedTarget,
  greenThreshold,
  yellowThreshold,
  redThreshold,
  actualValue,
}: KpiPerformanceInput): KpiPerformanceResult {
  const deviation = actualValue - plannedTarget
  const percentageDeviation =
    plannedTarget === 0 ? null : (deviation / Math.abs(plannedTarget)) * 100

  let status: PerformanceStatus = 'red'

  if (readingType === 'higher_is_better') {
    if (actualValue >= greenThreshold) status = 'green'
    else if (actualValue >= yellowThreshold) status = 'yellow'
    else status = 'red'
  } else if (readingType === 'lower_is_better') {
    if (actualValue <= greenThreshold) status = 'green'
    else if (actualValue <= yellowThreshold) status = 'yellow'
    else status = 'red'
  } else {
    const distance = Math.abs(actualValue - plannedTarget)
    if (distance <= greenThreshold) status = 'green'
    else if (distance <= yellowThreshold) status = 'yellow'
    else status = 'red'
  }

  return {
    status,
    absoluteDeviation: deviation,
    percentageDeviation,
  }
}

export function validateThresholdOrder(
  readingType: KpiReadingType,
  greenThreshold: number,
  yellowThreshold: number,
  redThreshold: number
) {
  if (readingType === 'higher_is_better') {
    return greenThreshold >= yellowThreshold && yellowThreshold >= redThreshold
  }

  return greenThreshold <= yellowThreshold && yellowThreshold <= redThreshold
}

export function getTrendFromValues(
  previousValue: number | null | undefined,
  currentValue: number | null | undefined,
  readingType: KpiReadingType
): KpiTrend | null {
  if (previousValue === null || previousValue === undefined || currentValue === null || currentValue === undefined) {
    return null
  }

  if (currentValue === previousValue) return 'stable'

  if (readingType === 'lower_is_better') {
    return currentValue < previousValue ? 'improving' : 'worsening'
  }

  if (readingType === 'higher_is_better') {
    return currentValue > previousValue ? 'improving' : 'worsening'
  }

  return Math.abs(currentValue) < Math.abs(previousValue) ? 'improving' : 'worsening'
}

export function periodsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
) {
  const startA = new Date(aStart).getTime()
  const endA = new Date(aEnd).getTime()
  const startB = new Date(bStart).getTime()
  const endB = new Date(bEnd).getTime()

  return startA <= endB && startB <= endA
}

export function getMonthPeriodLabel(year: number, monthIndex: number) {
  const month = KPI_MONTH_OPTIONS[monthIndex]
  return `${month.label}/${String(year).slice(-2)}`
}

export function getMonthStartDate(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10)
}

export function getMonthEndDate(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10)
}

export function getYearFromDate(date: string | null | undefined) {
  if (!date) return null
  return new Date(date).getUTCFullYear()
}

export function getMonthIndexFromDate(date: string | null | undefined) {
  if (!date) return null
  return new Date(date).getUTCMonth()
}

// Iniciais para avatar
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('')
}
