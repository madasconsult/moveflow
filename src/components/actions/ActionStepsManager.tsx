'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Plus, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { calculateActionStepProgress } from '@/lib/action-steps'
import { createClient } from '@/lib/supabase/client'
import {
  ACTION_STATUS_COLORS,
  ACTION_STATUS_LABELS,
  cn,
  formatDate,
} from '@/lib/utils'
import type {
  ActionStatus,
  ActionStep,
  InsertDto,
  UpdateDto,
} from '@/types/database.types'

interface ActionStepsManagerProps {
  actionId: string
  actionStatus: ActionStatus
  actionCompletionDate: string | null
  initialSteps: ActionStep[]
  canEdit: boolean
}

interface StepDraft {
  title: string
  description: string
  status: ActionStatus
  due_date: string
}

const STATUS_OPTIONS: ActionStatus[] = [
  'not_started',
  'in_progress',
  'waiting_client',
  'waiting_faus',
  'overdue',
  'completed',
  'cancelled',
]

function toDraft(step: ActionStep): StepDraft {
  return {
    title: step.title,
    description: step.description ?? '',
    status: step.status,
    due_date: step.due_date ?? '',
  }
}

export function ActionStepsManager({
  actionId,
  actionStatus,
  actionCompletionDate,
  initialSteps,
  canEdit,
}: ActionStepsManagerProps) {
  const router = useRouter()
  const supabase = createClient()
  const [steps, setSteps] = useState(initialSteps)
  const [parentStatus, setParentStatus] = useState(actionStatus)
  const [parentCompletionDate, setParentCompletionDate] = useState(actionCompletionDate)
  const [drafts, setDrafts] = useState<Record<string, StepDraft>>(
    Object.fromEntries(initialSteps.map(step => [step.id, toDraft(step)]))
  )
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newStatus, setNewStatus] = useState<ActionStatus>('not_started')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const progress = useMemo(() => calculateActionStepProgress(steps), [steps])

  function updateDraft(stepId: string, nextDraft: StepDraft) {
    setDrafts(current => ({
      ...current,
      [stepId]: nextDraft,
    }))
    setSuccess(null)
    setError(null)
  }

  async function syncParentAction(nextSteps: ActionStep[]) {
    const nextProgress = calculateActionStepProgress(nextSteps)
    if (nextProgress.total === 0) return

    const hasInProgressStep = nextSteps.some(step => step.status === 'in_progress')
    let nextStatus: ActionStatus | null = null
    let nextCompletionDate: string | null | undefined

    if (nextProgress.completed === nextProgress.total) {
      nextStatus = 'completed'
      nextCompletionDate = parentCompletionDate ?? new Date().toISOString()
    } else if (parentStatus === 'completed') {
      nextStatus = 'in_progress'
      nextCompletionDate = null
    } else if (hasInProgressStep && parentStatus !== 'cancelled') {
      nextStatus = 'in_progress'
    }

    if (!nextStatus) return
    if (nextStatus === parentStatus && nextCompletionDate === undefined) return

    const updatePayload: UpdateDto<'actions'> = {
      status: nextStatus,
    }

    if (nextCompletionDate !== undefined) {
      updatePayload.completion_date = nextCompletionDate
    }

    const { error: actionError } = await (supabase.from('actions') as any)
      .update(updatePayload)
      .eq('id', actionId)

    if (actionError) throw new Error(actionError.message)

    setParentStatus(nextStatus)
    if (nextCompletionDate !== undefined) {
      setParentCompletionDate(nextCompletionDate)
    }
  }

  async function handleCreateStep() {
    if (!canEdit || !newTitle.trim()) return

    setCreating(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: authData } = await supabase.auth.getUser()
      const completionDate = newStatus === 'completed' ? new Date().toISOString() : null
      const insertPayload: InsertDto<'action_steps'> = {
        action_id: actionId,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        status: newStatus,
        due_date: newDueDate || null,
        completion_date: completionDate,
        sort_order: steps.length + 1,
        created_by: authData.user?.id ?? null,
      }

      const { data, error: insertError } = await (supabase.from('action_steps') as any)
        .insert(insertPayload)
        .select('*')
        .single()

      if (insertError || !data) {
        throw new Error(insertError?.message ?? 'Não foi possível criar a etapa.')
      }

      const createdStep = data as ActionStep
      const nextSteps = [...steps, createdStep]
      setSteps(nextSteps)
      setDrafts(current => ({
        ...current,
        [createdStep.id]: toDraft(createdStep),
      }))
      setNewTitle('')
      setNewDescription('')
      setNewDueDate('')
      setNewStatus('not_started')
      await syncParentAction(nextSteps)
      setSuccess('Etapa criada com sucesso.')
      router.refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Não foi possível criar a etapa.')
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveStep(step: ActionStep) {
    const draft = drafts[step.id]
    if (!canEdit || !draft || !draft.title.trim()) return

    setSavingId(step.id)
    setError(null)
    setSuccess(null)

    try {
      const completionDate =
        draft.status === 'completed'
          ? step.completion_date ?? new Date().toISOString()
          : null

      const updatePayload: UpdateDto<'action_steps'> = {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        status: draft.status,
        due_date: draft.due_date || null,
        completion_date: completionDate,
      }

      const { data, error: updateError } = await (supabase.from('action_steps') as any)
        .update(updatePayload)
        .eq('id', step.id)
        .select('*')
        .single()

      if (updateError || !data) {
        throw new Error(updateError?.message ?? 'Não foi possível atualizar a etapa.')
      }

      const updatedStep = data as ActionStep
      const nextSteps = steps.map(item => item.id === updatedStep.id ? updatedStep : item)
      setSteps(nextSteps)
      setDrafts(current => ({
        ...current,
        [updatedStep.id]: toDraft(updatedStep),
      }))
      await syncParentAction(nextSteps)
      setSuccess('Etapa atualizada com sucesso.')
      router.refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Não foi possível atualizar a etapa.')
    } finally {
      setSavingId(null)
    }
  }

  async function handleCompleteStep(step: ActionStep) {
    if (!canEdit || step.status === 'completed') return

    setSavingId(step.id)
    setError(null)
    setSuccess(null)

    try {
      const { data, error: updateError } = await (supabase.from('action_steps') as any)
        .update({
          status: 'completed',
          completion_date: step.completion_date ?? new Date().toISOString(),
        })
        .eq('id', step.id)
        .select('*')
        .single()

      if (updateError || !data) {
        throw new Error(updateError?.message ?? 'Não foi possível concluir a etapa.')
      }

      const updatedStep = data as ActionStep
      const nextSteps = steps.map(item => item.id === updatedStep.id ? updatedStep : item)
      setSteps(nextSteps)
      setDrafts(current => ({
        ...current,
        [updatedStep.id]: toDraft(updatedStep),
      }))
      await syncParentAction(nextSteps)
      setSuccess('Etapa marcada como concluída.')
      router.refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Não foi possível concluir a etapa.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Etapas da ação</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {progress.total === 0
              ? 'Nenhuma etapa cadastrada.'
              : `${progress.completed} de ${progress.total} etapas concluídas.`}
          </p>
        </div>
        <div className="min-w-[220px]">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Progresso</span>
            <span>{progress.percentage}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      </div>

      {(error || success) && (
        <div
          className={cn(
            'rounded-lg border px-4 py-3 text-sm',
            error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          )}
        >
          {error ?? success}
        </div>
      )}

      {canEdit && (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_150px_180px_auto]">
            <input
              value={newTitle}
              onChange={event => setNewTitle(event.target.value)}
              className="input"
              placeholder="Título da etapa"
              disabled={creating}
            />
            <input
              value={newDescription}
              onChange={event => setNewDescription(event.target.value)}
              className="input"
              placeholder="Descrição opcional"
              disabled={creating}
            />
            <input
              type="date"
              value={newDueDate}
              onChange={event => setNewDueDate(event.target.value)}
              className="input"
              disabled={creating}
            />
            <select
              value={newStatus}
              onChange={event => setNewStatus(event.target.value as ActionStatus)}
              className="input"
              disabled={creating}
            >
              {STATUS_OPTIONS.map(status => (
                <option key={status} value={status}>
                  {ACTION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-primary justify-center"
              onClick={handleCreateStep}
              disabled={creating || !newTitle.trim()}
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Adicionar
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-neutral-200">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-3">Etapa</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Prazo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Conclusão</th>
              {canEdit && <th className="px-4 py-3 text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {steps.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="px-4 py-6 text-center text-neutral-500">
                  Nenhuma etapa cadastrada para esta ação.
                </td>
              </tr>
            ) : (
              steps.map(step => {
                const draft = drafts[step.id]
                const isSaving = savingId === step.id

                return (
                  <tr key={step.id} className="transition-colors hover:bg-neutral-50">
                    <td className="px-4 py-3 align-top">
                      {canEdit ? (
                        <input
                          value={draft.title}
                          onChange={event => updateDraft(step.id, { ...draft, title: event.target.value })}
                          className="input min-w-[220px]"
                          disabled={isSaving}
                        />
                      ) : (
                        <span className="font-medium text-neutral-900">{step.title}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {canEdit ? (
                        <input
                          value={draft.description}
                          onChange={event => updateDraft(step.id, { ...draft, description: event.target.value })}
                          className="input min-w-[240px]"
                          disabled={isSaving}
                        />
                      ) : (
                        <span className="text-neutral-700">{step.description ?? '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {canEdit ? (
                        <input
                          type="date"
                          value={draft.due_date}
                          onChange={event => updateDraft(step.id, { ...draft, due_date: event.target.value })}
                          className="input min-w-[150px]"
                          disabled={isSaving}
                        />
                      ) : (
                        <span className="text-neutral-700">{formatDate(step.due_date)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {canEdit ? (
                        <select
                          value={draft.status}
                          onChange={event => updateDraft(step.id, { ...draft, status: event.target.value as ActionStatus })}
                          className="input min-w-[180px]"
                          disabled={isSaving}
                        >
                          {STATUS_OPTIONS.map(status => (
                            <option key={status} value={status}>
                              {ACTION_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={cn('badge', ACTION_STATUS_COLORS[step.status])}>
                          {ACTION_STATUS_LABELS[step.status]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-neutral-700">
                      {formatDate(step.completion_date)}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleSaveStep(step)}
                            disabled={isSaving || !draft.title.trim()}
                          >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Salvar
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleCompleteStep(step)}
                            disabled={isSaving || step.status === 'completed'}
                          >
                            <CheckCircle2 size={16} />
                            Concluir
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
