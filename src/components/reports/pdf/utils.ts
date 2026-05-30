import { ACTION_STATUS_LABELS, MEETING_TYPE_LABELS } from '@/lib/utils'
import type { ReportAction, ReportData } from '@/components/reports/pdf/types'

export const CONSULTANT_COMMENT_MAX_LENGTH = 1800

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
    timeZone: 'America/Sao_Paulo',
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

export function isReportActionOverdue(action: ReportAction, referenceDate = new Date()) {
  if (!action.due_date || action.completion_date || action.status === 'completed' || action.status === 'cancelled') {
    return false
  }

  const today = referenceDate.toISOString().slice(0, 10)
  return action.due_date < today
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

export function getMeetingTypeLabel(type: ReportData['meetings'][number]['meeting_type']) {
  return MEETING_TYPE_LABELS[type] ?? type
}

export function getActionStats(actions: ReportAction[]) {
  const completed = actions.filter(action => action.status === 'completed' || action.completion_date).length
  const inProgress = actions.filter(action => action.status === 'in_progress').length
  const overdue = actions.filter(action => isReportActionOverdue(action) || action.status === 'overdue').length
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
