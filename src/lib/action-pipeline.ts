import { calculateActionStepProgress } from '@/lib/action-steps'
import type { ActionStatus } from '@/types/database.types'

export const ACTION_PIPELINE_STATUS_ORDER: ActionStatus[] = [
  'not_started',
  'in_progress',
  'waiting_client',
  'waiting_faus',
  'overdue',
  'completed',
  'cancelled',
]

interface ActionProgressSource {
  status: ActionStatus
  completion_date: string | null
  progress_percentage?: number | null
}

interface ActionStepProgressSource {
  status: ActionStatus
}

interface ActionDueDateSource {
  title: string
  due_date: string | null
  status: ActionStatus
  completion_date: string | null
}

function startOfToday(referenceDate = new Date()) {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

export function getActionProgressPercent(
  action: ActionProgressSource,
  steps: ActionStepProgressSource[] | null | undefined
) {
  const stepProgress = calculateActionStepProgress(steps ?? [])

  if (stepProgress.total > 0) {
    return stepProgress.percentage
  }

  if (typeof action.progress_percentage === 'number') {
    return Math.max(0, Math.min(100, Math.round(action.progress_percentage)))
  }

  if (action.status === 'completed' || action.completion_date) {
    return 100
  }

  return 0
}

export function isActionOverdue(action: ActionDueDateSource, referenceDate = new Date()) {
  if (!action.due_date || action.status === 'completed' || action.status === 'cancelled') return false

  const dueDate = parseDateOnly(action.due_date)
  if (!dueDate) return false

  return dueDate < startOfToday(referenceDate)
}

export function sortActionsByDueDate<T extends ActionDueDateSource>(actions: T[], referenceDate = new Date()) {
  return [...actions].sort((left, right) => {
    const leftOverdue = isActionOverdue(left, referenceDate)
    const rightOverdue = isActionOverdue(right, referenceDate)

    if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1
    if (!left.due_date && right.due_date) return 1
    if (left.due_date && !right.due_date) return -1
    if (left.due_date && right.due_date && left.due_date !== right.due_date) {
      return left.due_date.localeCompare(right.due_date)
    }

    return left.title.localeCompare(right.title, 'pt-BR')
  })
}

export function groupActionsByStatus<T extends { status: ActionStatus }>(actions: T[]) {
  return ACTION_PIPELINE_STATUS_ORDER.map(status => ({
    status,
    actions: actions.filter(action => action.status === status),
  }))
}
