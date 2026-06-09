'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, Plus, Users, X } from 'lucide-react'
import { createAction, updateAction } from '@/app/dashboard/acoes/actions'
import type { NewExternalStakeholder } from '@/app/dashboard/acoes/actions'
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
  ProjectExternalStakeholder,
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
  /** Nome do projeto ativo — para exibição no aviso de divergência */
  activeProjectName?: string | null
  /** client_id do projeto ativo — para detectar mismatch de cliente */
  activeClientId?: string | null
  /** Nome do cliente ativo — para exibição contextual */
  activeClientName?: string | null
  /** Envolvidos externos já cadastrados no projeto (para seleção) */
  projectStakeholders?: ProjectExternalStakeholder[]
  /** IDs de envolvidos externos já vinculados a esta ação (edição) */
  initialExternalStakeholderIds?: string[]
}

interface FormErrors {
  project_id?: string
  title?: string
}

/** Envolvido novo criado inline antes do submit — tem apenas dados locais, sem ID de banco */
interface PendingStakeholder extends NewExternalStakeholder {
  /** Key local para controle de lista/remoção */
  localKey: string
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
  activeProjectName,
  activeClientId,
  activeClientName,
  projectStakeholders = [],
  initialExternalStakeholderIds = [],
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

  // Alerta de mismatch: admin selecionou projeto diferente do filtro ativo.
  const [showMismatchAlert, setShowMismatchAlert] = useState(false)

  // ── Envolvidos externos ──────────────────────────────────────────────────────

  /** IDs de stakeholders existentes (de projectStakeholders) selecionados para esta ação */
  const [selectedExternalIds, setSelectedExternalIds] = useState<string[]>(
    initialExternalStakeholderIds,
  )

  /** Novos stakeholders adicionados inline, ainda não persistidos no banco */
  const [pendingStakeholders, setPendingStakeholders] = useState<PendingStakeholder[]>([])

  /** Controla visibilidade do formulário inline de novo envolvido */
  const [showAddStakeholder, setShowAddStakeholder] = useState(false)

  /** Campos do formulário inline */
  const [newName, setNewName]           = useState('')
  const [newRoleTitle, setNewRoleTitle] = useState('')
  const [newEmail, setNewEmail]         = useState('')
  const [newPhone, setNewPhone]         = useState('')
  const [newNameError, setNewNameError] = useState('')

  function toggleExternalStakeholder(id: string) {
    setSelectedExternalIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    )
  }

  function removePendingStakeholder(localKey: string) {
    setPendingStakeholders(prev => prev.filter(s => s.localKey !== localKey))
  }

  function handleAddStakeholder() {
    const trimmed = newName.trim()
    if (!trimmed) {
      setNewNameError('O nome é obrigatório.')
      return
    }
    // Evita duplicata (case-insensitive) contra cadastrados e pendentes
    const nameLower = trimmed.toLowerCase()
    const duplicateExisting = projectStakeholders.some(s => s.name.toLowerCase() === nameLower)
    const duplicatePending  = pendingStakeholders.some(s => s.name.toLowerCase() === nameLower)
    if (duplicateExisting || duplicatePending) {
      setNewNameError('Já existe um envolvido com este nome neste projeto.')
      return
    }

    setPendingStakeholders(prev => [
      ...prev,
      {
        localKey:   `${Date.now()}-${Math.random()}`,
        name:       trimmed,
        role_title: newRoleTitle.trim() || null,
        email:      newEmail.trim() || null,
        phone:      newPhone.trim() || null,
      },
    ])

    // Limpa e fecha o formulário inline
    setNewName('')
    setNewRoleTitle('')
    setNewEmail('')
    setNewPhone('')
    setNewNameError('')
    setShowAddStakeholder(false)
  }

  // ── Opções de seleção ────────────────────────────────────────────────────────

  const statusOptions = useMemo(
    () => Object.entries(ACTION_STATUS_LABELS) as [ActionStatus, string][],
    [],
  )
  const priorityOptions = useMemo(
    () => Object.entries(ACTION_PRIORITY_LABELS) as [ActionPriority, string][],
    [],
  )
  const classificationOptions = useMemo(
    () => Object.entries(ACTION_CLASSIFICATION_LABELS) as [ActionClassification, string][],
    [],
  )

  // ── Lógica de controle ────────────────────────────────────────────────────────

  function toggleAssignee(id: string) {
    setAssignedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    )
  }

  function validate() {
    const nextErrors: FormErrors = {}
    if (!projectId) nextErrors.project_id = 'Selecione o projeto vinculado.'
    if (!title.trim()) nextErrors.title = 'Informe o título da ação.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  /**
   * Detecta se o projeto selecionado diverge do filtro ativo (projeto ou cliente diferente).
   * Aplica apenas na criação — na edição o admin age intencionalmente.
   */
  function hasFilterMismatch(): boolean {
    if (!isAdmin || mode !== 'create') return false
    if (activeProjectId && projectId !== activeProjectId) return true
    if (activeClientId) {
      const selected = projects.find(p => p.id === projectId)
      if (selected && selected.client_id !== activeClientId) return true
    }
    return false
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

    // Monta payload de envolvidos externos
    const externalStakeholderIds    = selectedExternalIds
    const newExternalStakeholders   = pendingStakeholders.map(({ localKey: _k, ...rest }) => rest)

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
          externalStakeholderIds,
          newExternalStakeholders,
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
          externalStakeholderIds,
          newExternalStakeholders,
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
          : 'Não foi possível salvar a ação. Tente novamente.',
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

    if (hasFilterMismatch()) {
      setShowMismatchAlert(true)
      return
    }

    await persistAction()
  }

  async function handleConfirmMismatch() {
    setShowMismatchAlert(false)
    await persistAction()
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-6">

      {/* Alerta de divergência: projeto selecionado ≠ projeto do filtro ativo */}
      {showMismatchAlert && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                Projeto diferente do filtro ativo
              </p>
              <p className="mt-1 text-sm text-amber-800">
                O projeto selecionado é diferente do projeto atualmente filtrado
                {activeProjectName ? ` (${activeProjectName})` : activeClientName ? ` — cliente: ${activeClientName}` : ''}.
                A ação será criada fora do escopo atualmente visível. Deseja continuar mesmo assim?
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
          {!canChooseProject && activeProjectId && (
            <p className="mt-1 text-xs text-neutral-500">
              Projeto do filtro ativo{activeClientName ? ` · ${activeClientName}` : ''}.
            </p>
          )}
        </div>

        {/* ── Responsáveis internos (action_assignees) — não alterado ── */}
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

        {/* ── Participantes do Cliente (envolvidos externos) ── */}
        <div className="md:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-neutral-400" />
              <p className="label !mb-0">Participantes do Cliente</p>
            </div>
            {!showAddStakeholder && (
              <button
                type="button"
                onClick={() => setShowAddStakeholder(true)}
                disabled={saving}
                className="btn-ghost flex items-center gap-1.5 text-xs"
              >
                <Plus size={13} />
                Adicionar envolvido
              </button>
            )}
          </div>

          {/* Formulário inline para novo envolvido */}
          {showAddStakeholder && (
            <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-brand-700">
                Novo envolvido
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="new_stakeholder_name" className="label text-xs">
                    Nome *
                  </label>
                  <input
                    id="new_stakeholder_name"
                    value={newName}
                    onChange={e => { setNewName(e.target.value); setNewNameError('') }}
                    className="input"
                    placeholder="Ex.: João Moreira"
                    disabled={saving}
                  />
                  {newNameError && <p className="mt-1 text-xs text-red-600">{newNameError}</p>}
                </div>
                <div>
                  <label htmlFor="new_stakeholder_role" className="label text-xs">
                    Cargo / Função
                  </label>
                  <input
                    id="new_stakeholder_role"
                    value={newRoleTitle}
                    onChange={e => setNewRoleTitle(e.target.value)}
                    className="input"
                    placeholder="Ex.: Supervisor de Estoque"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label htmlFor="new_stakeholder_email" className="label text-xs">
                    E-mail
                  </label>
                  <input
                    id="new_stakeholder_email"
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="input"
                    placeholder="Ex.: joao@empresa.com"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label htmlFor="new_stakeholder_phone" className="label text-xs">
                    Telefone
                  </label>
                  <input
                    id="new_stakeholder_phone"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    className="input"
                    placeholder="Ex.: (11) 9 9999-9999"
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddStakeholder}
                  disabled={saving}
                  className="btn-primary text-sm"
                >
                  Adicionar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddStakeholder(false)
                    setNewName('')
                    setNewRoleTitle('')
                    setNewEmail('')
                    setNewPhone('')
                    setNewNameError('')
                  }}
                  disabled={saving}
                  className="btn-secondary text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Lista de envolvidos existentes no projeto */}
          {projectStakeholders.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {projectStakeholders.map(s => {
                const checked = selectedExternalIds.includes(s.id)
                return (
                  <label
                    key={s.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                      checked
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                    } ${saving ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleExternalStakeholder(s.id)}
                      disabled={saving}
                      className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      <span className="block text-sm font-medium leading-tight">{s.name}</span>
                      {s.role_title && (
                        <span className="block text-xs text-neutral-500">{s.role_title}</span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
          )}

          {/* Novos envolvidos adicionados nesta sessão (pendentes) */}
          {pendingStakeholders.length > 0 && (
            <div className={`${projectStakeholders.length > 0 ? 'mt-2' : ''} grid gap-2 sm:grid-cols-2 lg:grid-cols-3`}>
              {pendingStakeholders.map(s => (
                <div
                  key={s.localKey}
                  className="flex items-start gap-3 rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2.5"
                >
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-indigo-600">
                    <span className="text-[9px] font-bold text-white">✓</span>
                  </div>
                  <span className="flex-1">
                    <span className="block text-sm font-medium leading-tight text-indigo-800">{s.name}</span>
                    {s.role_title && (
                      <span className="block text-xs text-indigo-600">{s.role_title}</span>
                    )}
                    <span className="mt-0.5 block text-[11px] text-indigo-500">Novo · será cadastrado ao salvar</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removePendingStakeholder(s.localKey)}
                    disabled={saving}
                    className="mt-0.5 shrink-0 text-indigo-400 hover:text-indigo-700"
                    title="Remover"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {projectStakeholders.length === 0 && pendingStakeholders.length === 0 && !showAddStakeholder && (
            <p className="text-sm text-neutral-400">
              Nenhum envolvido do cliente cadastrado neste projeto.
              Use o botão acima para adicionar.
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
