'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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
  InsertDto,
  UpdateDto,
} from '@/types/database.types'

interface ProjectOption {
  id: string
  project_name: string
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
}: ActionFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [projectId, setProjectId] = useState(initialData?.project_id ?? projects[0]?.id ?? '')
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [assignedTo, setAssignedTo] = useState(initialData?.assigned_to ?? '')
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

  function validate() {
    const nextErrors: FormErrors = {}

    if (!projectId) nextErrors.project_id = 'Selecione o projeto vinculado.'
    if (!title.trim()) nextErrors.title = 'Informe o título da ação.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!validate()) return

    setSaving(true)

    const titleValue = title.trim()
    const descriptionValue = description.trim() || null
    const assignedToValue = assignedTo || null
    const dueDateValue = dueDate || null
    const notesValue = notes.trim() || null
    const completionDateValue =
      status === 'completed'
        ? initialData?.completion_date ?? new Date().toISOString()
        : null

    const updatePayload: UpdateDto<'actions'> = {
      title: titleValue,
      description: descriptionValue,
      assigned_to: assignedToValue,
      due_date: dueDateValue,
      priority,
      status,
      classification,
      completion_date: completionDateValue,
      notes: notesValue,
      visible_to_client: visibleToClient,
    }

    try {
      const actionsTable = supabase.from('actions') as any

      if (mode === 'create') {
        const { data: authData } = await supabase.auth.getUser()
        const insertPayload: InsertDto<'actions'> = {
          project_id: projectId,
          title: titleValue,
          description: descriptionValue,
          assigned_to: assignedToValue,
          due_date: dueDateValue,
          priority,
          status,
          classification,
          completion_date: completionDateValue,
          notes: notesValue,
          visible_to_client: visibleToClient,
          created_by: authData.user?.id ?? null,
        }

        const { data, error } = await actionsTable
          .insert(insertPayload)
          .select('id')
          .single()

        if (error || !data) {
          throw new Error(error?.message ?? 'Não foi possível criar a ação.')
        }

        router.push(`/dashboard/acoes/${(data as { id: string }).id}`)
      } else if (initialData) {
        const { data, error } = await actionsTable
          .update(updatePayload)
          .eq('id', initialData.id)
          .select('id')
          .single()

        if (error || !data) {
          throw new Error(error?.message ?? 'Não foi possível atualizar a ação.')
        }

        router.push(`/dashboard/acoes/${(data as { id: string }).id}`)
      }

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

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-6">
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
            disabled={saving || mode === 'edit' || !canChooseProject}
          >
            <option value="">Selecione</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.project_name}
              </option>
            ))}
          </select>
          {errors.project_id && <p className="mt-1 text-xs text-red-600">{errors.project_id}</p>}
        </div>

        <div>
          <label htmlFor="assigned_to" className="label">
            Responsável
          </label>
          <select
            id="assigned_to"
            value={assignedTo}
            onChange={event => setAssignedTo(event.target.value)}
            className="input"
            disabled={saving}
          >
            <option value="">Não definido</option>
            {responsibles.map(option => (
              <option key={option.id} value={option.id}>
                {option.full_name}
              </option>
            ))}
          </select>
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
        <Link href={initialData ? `/dashboard/acoes/${initialData.id}` : '/dashboard/acoes'} className="btn-secondary">
          Cancelar
        </Link>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving && <Loader2 size={16} className="animate-spin" />}
          {mode === 'create' ? 'Criar ação' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}
