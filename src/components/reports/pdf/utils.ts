import { ACTION_STATUS_LABELS, MEETING_TYPE_LABELS } from '@/lib/utils'
import type { ReportAction, ReportData } from '@/components/reports/pdf/types'

export const CONSULTANT_COMMENT_MAX_LENGTH = 1800

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function safeNumber(value: unknown, fallback = 0) {
  return isFiniteNumber(value) ? value : fallback
}

export function clamp(value: unknown, min: number, max: number) {
  const safeValue = safeReportNumber(value, min)
  const safeMin = safeReportNumber(min, 0)
  const safeMax = Math.max(safeReportNumber(max, safeMin), safeMin)

  return Math.min(Math.max(safeValue, safeMin), safeMax)
}

export function safeReportNumber(value: unknown, fallback = 0) {
  return isFiniteNumber(value) ? value : fallback
}

export function safeReportPercent(value: unknown, total: unknown) {
  const safeTotal = safeReportNumber(total, 0)
  if (safeTotal <= 0) return 0

  return clamp((safeReportNumber(value, 0) / safeTotal) * 100, 0, 100)
}

export function safeReportBarWidth(value: unknown, total: unknown, maxWidth: unknown) {
  const safeMaxWidth = Math.max(safeReportNumber(maxWidth, 0), 0)
  if (safeMaxWidth === 0) return 0

  return clamp((safeMaxWidth * safeReportPercent(value, total)) / 100, 0, safeMaxWidth)
}

export function safeReportScore(value: unknown, maxScore = 5) {
  const safeMaxScore = Math.max(safeReportNumber(maxScore, 5), 0)
  if (safeMaxScore === 0 || !isFiniteNumber(value)) return null

  return clamp(value, 0, safeMaxScore)
}

export function safePercent(value: unknown, total: unknown) {
  return safeReportPercent(value, total)
}

export function safeBarWidth(value: unknown, total: unknown, maxWidth: unknown) {
  return safeReportBarWidth(value, total, maxWidth)
}

export function safeScore(value: unknown, maxScore = 5) {
  return safeReportScore(value, maxScore)
}

export function sanitizeConsultantComment(value: unknown) {
  if (typeof value !== 'string') return null

  const normalized = value
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()

  if (!normalized) return null

  return normalized.slice(0, CONSULTANT_COMMENT_MAX_LENGTH)
}

export function formatReportDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value))
}

export function formatReportDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function getReportPeriodLabel(data: ReportData) {
  return `${formatReportDate(data.period.startDate)} a ${formatReportDate(data.period.endDate)}`
}

export function isWithinPeriod(value: string | null | undefined, startDate: string, endDate: string) {
  if (!value) return false
  const normalizedValue = value.slice(0, 10)
  return normalizedValue >= startDate && normalizedValue <= endDate
}

export type ReportActionVisualStatus = 'completed' | 'overdue' | 'in_progress'
type ReportActionStatusTone = 'neutral' | 'success' | 'warning' | 'danger'

export function isReportActionOverdue(action: ReportAction, referenceDate: Date | string = new Date()) {
  if (!action.due_date || action.completion_date || action.status === 'completed' || action.status === 'cancelled') {
    return false
  }

  return action.due_date < getReferenceDateKey(referenceDate)
}

export function getActionsCompletedInPeriod(actions: ReportAction[], startDate: string, endDate: string) {
  return actions.filter(action => isWithinPeriod(action.completion_date, startDate, endDate))
}

export function getActionsCreatedInPeriod(actions: ReportAction[], startDate: string, endDate: string) {
  return actions.filter(action => isWithinPeriod(action.created_at, startDate, endDate))
}

export function getActionsDueInPeriod(actions: ReportAction[], startDate: string, endDate: string) {
  return actions.filter(action => isWithinPeriod(action.due_date, startDate, endDate))
}

export function getActionStatusLabel(action: ReportAction) {
  return ACTION_STATUS_LABELS[action.status] ?? action.status
}

export function getActionVisualStatus(action: ReportAction, referenceDate: Date | string = new Date()): ReportActionVisualStatus {
  if (action.completion_date || action.status === 'completed') {
    return 'completed'
  }
  if (isReportActionOverdue(action, referenceDate) || action.status === 'overdue') {
    return 'overdue'
  }

  return 'in_progress'
}

export function getActionVisualStatusLabel(action: ReportAction, referenceDate: Date | string = new Date()) {
  const status = getActionVisualStatus(action, referenceDate)
  if (status === 'completed') return 'Concluída'
  if (status === 'overdue') return 'Atrasada'
  return 'Em andamento'
}

export function getActionVisualStatusTone(
  action: ReportAction,
  referenceDate: Date | string = new Date()
): ReportActionStatusTone {
  const status = getActionVisualStatus(action, referenceDate)
  if (status === 'completed') {
    return 'success'
  }
  if (status === 'overdue') {
    return 'danger'
  }

  return 'warning'
}

export function getMeetingTypeLabel(type: ReportData['meetings'][number]['meeting_type']) {
  return MEETING_TYPE_LABELS[type] ?? type
}

export function getActionStats(actions: ReportAction[], referenceDate: Date | string = new Date()) {
  const completed = actions.filter(action => getActionVisualStatus(action, referenceDate) === 'completed').length
  const inProgress = actions.filter(action => getActionVisualStatus(action, referenceDate) === 'in_progress').length
  const overdue = actions.filter(action => getActionVisualStatus(action, referenceDate) === 'overdue').length
  const total = actions.length

  return {
    total,
    completed,
    inProgress,
    overdue,
    completionPercent: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
}

export function getActionsByStatus(actions: ReportAction[]) {
  return actions.reduce<Record<string, number>>((acc, action) => {
    const label = getActionStatusLabel(action)
    acc[label] = (acc[label] ?? 0) + 1
    return acc
  }, {})
}

export function limitItems<T>(items: T[], limit = 8) {
  return items.slice(0, limit)
}

function getReferenceDateKey(referenceDate: Date | string) {
  if (typeof referenceDate === 'string') {
    return referenceDate.slice(0, 10)
  }

  return referenceDate.toISOString().slice(0, 10)
}
