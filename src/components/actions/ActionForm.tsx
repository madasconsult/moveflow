'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { createAction, updateAction } from '@/app/dashboard/acoes/actions'
import {
  ACTION_CLASSIFICATION_LABELS,
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_LABELS,
} from '@/lib/utils'
import type {
  Action,
  ActionClassification,
  ActionPriority,
  ActionStatus,
} from '@/types/database.types'

interface ProjectOption {
  id: string
  project_name: string
  client_id: string
}

interface ResponsibleOption {
  id: string
  full_name: string
}

interface ActionFormProps {
  mode: 'create' | 'edit'
  initialData?: Action
  projects: ProjectOption[]
  responsibles: ResponsibleOption[]
  canChooseProject: boolean
  /** IDs dos responsáveis já vinculados (action_assignees) — para edição */
  initialAssigneeIds?: string[]
  /** Indica se o usuário logado é admin_faus */
  isAdmin: boolean
  /** ID do projeto ativo no filtro global (cookie) */
  activeProjectId?: string | null
  /** client_id do projeto ativo — para detectar mismatch de cliente */
  activeClientId?: string | null
  /** Nome do cliente ativo — para exibição contextual */
  activeClientName?: string | null
}

interface FormErrors {
  project_id?: string
  title?: string
}

export function ActionForm({
  mode,
  initialData,
  projects,
  responsibles,
  canChooseProject,
  initialAssigneeIds = [],
  isAdmin,
  activeProjectId,
  activeClientId,
  activeClientName,
}: ActionFormProps) {
  const router = useRouter()

  const defaultProjectId =
    initialData?.project_id ?? activeProjectId ?? projects[0]?.id ?? ''

  const [projectId, setProjectId] = useState(defaultProjectId)
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')

  const [assignedIds, setAssignedIds] = useState<string[]>(() => {
    if (initialAssigneeIds.length > 0) return initialAssigneeIds
    if (initialData?.assigned_to) return [initialData.assigned_to]
    return []
  })

  const [status, setStatus] = useState<ActionStatus>(initialData?.status ?? 'not_started')
  const [priority, setPriority] = useState<ActionPriority>(initialData?.priority ?? 'medium')
  const [classification, setClassification] = useState<ActionClassification>(
    initialData?.classification ?? 'operational_support'
  )
  const [dueDate, setDueDate] = useState(initialData?.due_date ?? '')
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [visibleToClient, setVisibleToClient] = useState(initialData?.visible_to_client ?? false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Alerta de mismatch: admin selecionou projeto de cliente diferente do filtro ativo.
  const [showMismatchAlert, setShowMismatchAlert] = useState(false)

  const statusOptions = useMemo(
    () => Object.entries(ACTION_STATUS_LABELS) as [ActionStatus, string][],
    []
  )
  const priorityOptions = useMemo(
    () => Object.entries(ACTION_PRIORITY_LABELS) as [ActionPriority, string][],
    []
  )
  const classificationOptions = useMemo(
    () => Object.entries(ACTION_CLASSIFICATION_LABELS) as [ActionClassification, string][],
    []
  )

  function toggleAssignee(id: string) {
    setAssignedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function validate() {
    const nextErrors: FormErrors = {}
    if (!projectId) nextErrors.project_id = 'Selecione o projeto vinculado.'
    if (!title.trim()) nextErrors.title = 'Informe o título da ação.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  /** Detecta se o projeto selecionado pertence a cliente diferente do filtro ativo. */
  function hasClientMismatch(): boolean {
    if (!isAdmin || !activeClientId) return false
    const selected = projects.find(p => p.id === projectId)
    if (!selected) return false
    return selected.client_id !== activeClientId
  }

  async function persistAction() {
    setSaving(true)

    const titleValue       = title.trim()
    const descriptionValue = description.trim() || null
    const dueDateValue     = dueDate || null
    const notesValue       = notes.trim() || null
    const completionDate =
      status === 'completed'
        ? initialData?.completion_date ?? new Date().toISOString()
        : null
    const assignedTo = assignedIds[0] ?? null

    try {
      let result: { actionId?: string; error?: string }

      if (mode === 'create') {
        result = await createAction({
          projectId,
          title: titleValue,
          description: descriptionValue,
          assignedTo,
          dueDate: dueDateValue,
          priority,
          status,
          classification,
          completionDate,
          notes: notesValue,
          visibleToClient,
          assigneeIds: assignedIds,
        })
      } else {
        if (!initialData) throw new Error('Dados iniciais ausentes para edição.')
        result = await updateAction(initialData.id, {
          projectId,
          title: titleValue,
          description: descriptionValue,
          assignedTo,
          dueDate: dueDateValue,
          priority,
          status,
          classification,
          completionDate,
          notes: notesValue,
          visibleToClient,
          assigneeIds: assignedIds,
        })
      }

      if (result.error) {
        setFormError(result.error)
        return
      }

      const actionId = result.actionId!
      router.push(`/dashboard/acoes/${actionId}`)
      router.refresh()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a ação. Tente novamente.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setShowMismatchAlert(false)

    if (!validate()) return

    if (hasClientMismatch()) {
      setShowMismatchAlert(true)
      return
    }

    await persistAction()
  }

  async function handleConfirmMismatch() {
    setShowMismatchAlert(false)
    await persistAction()
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-6">

      {/* Alerta de mismatch de cliente */}
      {showMismatchAlert && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                Cliente diferente do filtro ativo
              </p>
              <p className="mt-1 text-sm text-amber-800">
                O cliente do projeto selecionado é diferente do cliente aplicado no filtro atual
                {activeClientName ? ` (${activeClientName})` : ''}.
                Deseja continuar mesmo assim?
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowMismatchAlert(false)}
                  className="btn-secondary text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMismatch}
                  className="btn-primary text-sm"
                  disabled={saving}
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Continuar mesmo assim
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {initialData?.business_id && (
          <div>
            <label className="label">ID da ação</label>
            <div className="input flex items-center bg-neutral-50 text-neutral-600">
              {initialData.business_id}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="project_id" className="label">
            Projeto *
          </label>
          <select
            id="project_id"
            value={projectId}
            onChange={event => setProjectId(event.target.value)}
            className="input"
            disabled={saving || !canChooseProject}
          >
            <option value="">Selecione</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.project_name}
              </option>
            ))}
          </select>
          {errors.project_id && <p className="mt-1 text-xs text-red-600">{errors.project_id}</p>}
          {!canChooseProject && activeClientName && (
            <p className="mt-1 text-xs text-neutral-500">
              Cliente: {activeClientName}
            </p>
          )}
        </div>

        {/* Seleção múltipla de responsáveis via checkboxes */}
        <div className="md:col-span-2">
          <p className="label mb-2">Responsáveis</p>
          {responsibles.length === 0 ? (
            <p className="text-sm text-neutral-400">Nenhum responsável disponível.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {responsibles.map(option => {
                const checked = assignedIds.includes(option.id)
                return (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                      checked
                        ? 'border-brand-300 bg-brand-50 text-brand-800'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                    } ${saving ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAssignee(option.id)}
                      disabled={saving}
                      className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm font-medium">{option.full_name}</span>
                  </label>
                )
              })}
            </div>
          )}
          {assignedIds.length === 0 && (
            <p className="mt-1.5 text-xs text-neutral-400">
              Nenhum responsável selecionado — ação ficará sem responsável.
            </p>
          )}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="title" className="label">
            Título da ação *
          </label>
          <input
            id="title"
            value={title}
            onChange={event => setTitle(event.target.value)}
            className="input"
            placeholder="Ex.: Validar desenho final do fluxo de expedição"
            disabled={saving}
          />
          {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="description" className="label">
            Descrição
          </label>
          <textarea
            id="description"
            value={description}
            onChange={event => setDescription(event.target.value)}
            className="input min-h-28 resize-y"
            placeholder="Contexto, expectativa de entrega e detalhes da execução."
            disabled={saving}
          />
        </div>

        <div>
          <label htmlFor="status" className="label">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={event => setStatus(event.target.value as ActionStatus)}
            className="input"
            disabled={saving}
          >
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="priority" className="label">
            Prioridade
          </label>
          <select
            id="priority"
            value={priority}
            onChange={event => setPriority(event.target.value as ActionPriority)}
            className="input"
            disabled={saving}
          >
            {priorityOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="classification" className="label">
            Classificação
          </label>
          <select
            id="classification"
            value={classification}
            onChange={event => setClassification(event.target.value as ActionClassification)}
            className="input"
            disabled={saving}
          >
            {classificationOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="due_date" className="label">
            Prazo
          </label>
          <input
            id="due_date"
            type="date"
            value={dueDate}
            onChange={event => setDueDate(event.target.value)}
            className="input"
            disabled={saving}
          />
        </div>

        <div>
          <label className="label">Data de conclusão</label>
          <div className="input flex items-center bg-neutral-50 text-neutral-600">
            {initialData?.completion_date
              ? new Date(initialData.completion_date).toLocaleDateString('pt-BR')
              : status === 'completed'
                ? 'Será definida ao salvar'
                : 'Ainda não concluída'}
          </div>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="notes" className="label">
            Observações internas
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={event => setNotes(event.target.value)}
            className="input min-h-24 resize-y"
            placeholder="Notas de acompanhamento, bloqueios ou observações operacionais."
            disabled={saving}
          />
        </div>

        <div className="md:col-span-2">
          <label className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <input
              type="checkbox"
              checked={visibleToClient}
              onChange={event => setVisibleToClient(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              disabled={saving}
            />
            <span>
              <span className="block text-sm font-medium text-neutral-800">Visível no portal do cliente</span>
              <span className="mt-1 block text-xs text-neutral-500">
                Ative apenas quando a ação puder aparecer também no ambiente externo do cliente.
              </span>
            </span>
          </label>
        </div>
      </div>

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link
          href={initialData ? `/dashboard/acoes/${initialData.id}` : '/dashboard/acoes'}
          className="btn-secondary"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          className="btn-primary"
          disabled={saving || showMismatchAlert}
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {mode === 'create' ? 'Criar ação' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}
