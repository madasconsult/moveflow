import type { ActionStatus } from '@/types/database.types'

interface ActionStepProgressItem {
  status: ActionStatus
}

export function calculateActionStepProgress(steps: ActionStepProgressItem[]) {
  const total = steps.length
  const completed = steps.filter(step => step.status === 'completed').length
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100)

  return {
    total,
    completed,
    percentage,
  }
}
