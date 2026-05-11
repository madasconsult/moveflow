'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  PROJECT_PHASE_LABELS,
  PROJECT_STATUS_LABELS,
  STRATEGIC_FOCUS_LABELS,
} from '@/lib/utils'
import type {
  InsertDto,
  Profile,
  Project,
  ProjectPhase,
  ProjectStatus,
  StrategicFocus,
  UpdateDto,
} from '@/types/database.types'

interface ClientOption {
  id: string
  company_name: string
}

interface ConsultantOption {
  id: string
  full_name: string
}

interface ProjectFormProps {
  mode: 'create' | 'edit'
  initialData?: Project
  clients: ClientOption[]
  consultants: ConsultantOption[]
  isAdmin: boolean
  currentUserId?: string
}

interface FormErrors {
  client_id?: string
  project_name?: string
  strategic_focus?: string
  main_objective?: string
  executive_scope?: string
}

function listToTextarea(values: string[] | null | undefined) {
  return values?.join('\n') ?? ''
}

export function ProjectForm({
  mode,
  initialData,
  clients,
  consultants,
  isAdmin,
  currentUserId,
}: ProjectFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [clientId, setClientId] = useState(initialData?.client_id ?? clients[0]?.id ?? '')
  const [projectName, setProjectName] = useState(initialData?.project_name ?? '')
  const [shortDescription, setShortDescription] = useState(initialData?.short_description ?? '')
  const [mainConsultantId, setMainConsultantId] = useState(initialData?.main_consultant_id ?? currentUserId ?? '')
  const [startDate, setStartDate] = useState(initialData?.start_date ?? '')
  const [plannedEndDate, setPlannedEndDate] = useState(initialData?.planned_end_date ?? '')
  const [status, setStatus] = useState<ProjectStatus>(initialData?.status ?? 'not_started')
  const [phase, setPhase] = useState<ProjectPhase>(initialData?.phase ?? 'initial_deployment')
  const [progressPercentage, setProgressPercentage] = useState(initialData?.progress_percentage ?? 0)
  const [strategicFocus, setStrategicFocus] = useState<StrategicFocus | ''>(initialData?.strategic_focus ?? '')
  const [mainObjective, setMainObjective] = useState(initialData?.main_objective ?? '')
  const [complementaryWorkstreams, setComplementaryWorkstreams] = useState(listToTextarea(initialData?.complementary_workstreams))
  const [executiveScope, setExecutiveScope] = useState(initialData?.executive_scope ?? '')
  const [scopeExclusions, setScopeExclusions] = useState(initialData?.scope_exclusions ?? '')
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const strategicOptions = useMemo(
    () => Object.entries(STRATEGIC_FOCUS_LABELS) as [StrategicFocus, string][],
    []
  )

  const statusOptions = useMemo(
    () => Object.entries(PROJECT_STATUS_LABELS) as [ProjectStatus, string][],
    []
  )

  const phaseOptions = useMemo(
    () => Object.entries(PROJECT_PHASE_LABELS) as [ProjectPhase, string][],
    []
  )

  function validate() {
    const nextErrors: FormErrors = {}

    if (!clientId) nextErrors.client_id = 'Selecione o cliente vinculado.'
    if (!projectName.trim()) nextErrors.project_name = 'Informe o nome do projeto.'
    if (!strategicFocus) nextErrors.strategic_focus = 'Selecione o foco estratégico.'
    if (!mainObjective.trim()) nextErrors.main_objective = 'Descreva o objetivo principal.'
    if (!executiveScope.trim()) nextErrors.executive_scope = 'Descreva o escopo executivo.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!validate()) return

    setSaving(true)

    const workstreams = complementaryWorkstreams
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean)

    const projectNameValue = projectName.trim()
    const shortDescriptionValue = shortDescription.trim() || null
    const mainConsultantValue = mainConsultantId || null
    const startDateValue = startDate || null
    const plannedEndDateValue = plannedEndDate || null
    const progressValue = Number.isFinite(Number(progressPercentage))
      ? Math.max(0, Math.min(100, Number(progressPercentage)))
      : 0
    const strategicFocusValue = strategicFocus as StrategicFocus
    const mainObjectiveValue = mainObjective.trim()
    const complementaryWorkstreamsValue = workstreams.length > 0 ? workstreams : null
    const executiveScopeValue = executiveScope.trim()
    const scopeExclusionsValue = scopeExclusions.trim() || null

    const updatePayload: UpdateDto<'projects'> = {
      project_name: projectNameValue,
      short_description: shortDescriptionValue,
      main_consultant_id: mainConsultantValue,
      start_date: startDateValue,
      planned_end_date: plannedEndDateValue,
      status,
      phase,
      progress_percentage: progressValue,
      strategic_focus: strategicFocusValue,
      main_objective: mainObjectiveValue,
      complementary_workstreams: complementaryWorkstreamsValue,
      executive_scope: executiveScopeValue,
      scope_exclusions: scopeExclusionsValue,
    }

    try {
      const projectsTable = supabase.from('projects') as any

      if (mode === 'create') {
        const { data: authData } = await supabase.auth.getUser()
        const authUserId = authData.user?.id ?? null

        if (!authUserId) {
          throw new Error('Usuário autenticado não encontrado.')
        }

        const effectiveMainConsultantId = isAdmin ? mainConsultantValue : authUserId

        const projectId = crypto.randomUUID()

        const insertPayload: InsertDto<'projects'> = {
          id: projectId,
          client_id: clientId,
          project_name: projectNameValue,
          short_description: shortDescriptionValue,
          main_consultant_id: effectiveMainConsultantId,
          start_date: startDateValue,
          planned_end_date: plannedEndDateValue,
          status,
          phase,
          progress_percentage: progressValue,
          strategic_focus: strategicFocusValue,
          main_objective: mainObjectiveValue,
          complementary_workstreams: complementaryWorkstreamsValue,
          executive_scope: executiveScopeValue,
          scope_exclusions: scopeExclusionsValue,
          created_by: authUserId,
        }

        const { error } = await projectsTable.insert({
          ...insertPayload,
        })

        if (error) {
          throw new Error(error.message ?? 'Não foi possível criar o projeto.')
        }

        router.push(`/dashboard/projetos/${projectId}`)
      } else if (initialData) {
        const { data, error } = await projectsTable
          .update(updatePayload)
          .eq('id', initialData.id)
          .select('id')
          .single()

        if (error || !data) {
          throw new Error(error?.message ?? 'Não foi possível atualizar o projeto.')
        }

        router.push(`/dashboard/projetos/${(data as { id: string }).id}`)
      }

      router.refresh()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o projeto. Tente novamente.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-6">
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Informações principais</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Dados centrais do projeto e vínculo operacional.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="client_id" className="label">
              Cliente *
            </label>
            <select
              id="client_id"
              value={clientId}
              onChange={event => setClientId(event.target.value)}
              className="input"
              disabled={saving || (mode === 'edit' && !isAdmin)}
            >
              <option value="">Selecione</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.company_name}
                </option>
              ))}
            </select>
            {errors.client_id && <p className="mt-1 text-xs text-red-600">{errors.client_id}</p>}
          </div>

          <div>
            <label htmlFor="main_consultant_id" className="label">
              Consultor principal
            </label>
            <select
              id="main_consultant_id"
              value={mainConsultantId}
              onChange={event => setMainConsultantId(event.target.value)}
              className="input"
              disabled={saving || !isAdmin}
            >
              <option value="">Não definido</option>
              {consultants.map(consultant => (
                <option key={consultant.id} value={consultant.id}>
                  {consultant.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="project_name" className="label">
              Nome do projeto *
            </label>
            <input
              id="project_name"
              value={projectName}
              onChange={event => setProjectName(event.target.value)}
              className="input"
              placeholder="Ex.: Redesenho logístico do CD principal"
              disabled={saving}
            />
            {errors.project_name && <p className="mt-1 text-xs text-red-600">{errors.project_name}</p>}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="short_description" className="label">
              Descrição curta
            </label>
            <textarea
              id="short_description"
              value={shortDescription}
              onChange={event => setShortDescription(event.target.value)}
              className="input min-h-24 resize-y"
              placeholder="Resumo executivo do contexto e da proposta do projeto."
              disabled={saving}
            />
          </div>

          <div>
            <label htmlFor="start_date" className="label">
              Data de início
            </label>
            <input
              id="start_date"
              type="date"
              value={startDate}
              onChange={event => setStartDate(event.target.value)}
              className="input"
              disabled={saving}
            />
          </div>

          <div>
            <label htmlFor="planned_end_date" className="label">
              Término planejado
            </label>
            <input
              id="planned_end_date"
              type="date"
              value={plannedEndDate}
              onChange={event => setPlannedEndDate(event.target.value)}
              className="input"
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
              onChange={event => setStatus(event.target.value as ProjectStatus)}
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
            <label htmlFor="phase" className="label">
              Fase
            </label>
            <select
              id="phase"
              value={phase}
              onChange={event => setPhase(event.target.value as ProjectPhase)}
              className="input"
              disabled={saving}
            >
              {phaseOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="progress_percentage" className="label">
              Progresso (%)
            </label>
            <input
              id="progress_percentage"
              type="number"
              min={0}
              max={100}
              value={progressPercentage}
              onChange={event => setProgressPercentage(Number(event.target.value))}
              className="input"
              disabled={saving}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-neutral-200 pt-6">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Bloco estratégico</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Este bloco é obrigatório para o projeto e precisa refletir o posicionamento consultivo da FAUS.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="strategic_focus" className="label">
              Foco estratégico *
            </label>
            <select
              id="strategic_focus"
              value={strategicFocus}
              onChange={event => setStrategicFocus(event.target.value as StrategicFocus)}
              className="input"
              disabled={saving}
            >
              <option value="">Selecione</option>
              {strategicOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.strategic_focus && <p className="mt-1 text-xs text-red-600">{errors.strategic_focus}</p>}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="main_objective" className="label">
              Objetivo principal *
            </label>
            <textarea
              id="main_objective"
              value={mainObjective}
              onChange={event => setMainObjective(event.target.value)}
              className="input min-h-24 resize-y"
              placeholder="Defina o objetivo central do projeto com clareza executiva."
              disabled={saving}
            />
            {errors.main_objective && <p className="mt-1 text-xs text-red-600">{errors.main_objective}</p>}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="complementary_workstreams" className="label">
              Frentes complementares
            </label>
            <textarea
              id="complementary_workstreams"
              value={complementaryWorkstreams}
              onChange={event => setComplementaryWorkstreams(event.target.value)}
              className="input min-h-28 resize-y"
              placeholder={'Uma frente por linha\nEx.: Padronização de indicadores\nEx.: Treinamento operacional'}
              disabled={saving}
            />
            <p className="mt-1 text-xs text-neutral-400">
              Use uma linha para cada frente complementar que deva ser armazenada no schema atual.
            </p>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="executive_scope" className="label">
              Escopo executivo *
            </label>
            <textarea
              id="executive_scope"
              value={executiveScope}
              onChange={event => setExecutiveScope(event.target.value)}
              className="input min-h-28 resize-y"
              placeholder="Descreva o escopo executivo que precisa ser entregue e acompanhado."
              disabled={saving}
            />
            {errors.executive_scope && <p className="mt-1 text-xs text-red-600">{errors.executive_scope}</p>}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="scope_exclusions" className="label">
              Exclusões de escopo
            </label>
            <textarea
              id="scope_exclusions"
              value={scopeExclusions}
              onChange={event => setScopeExclusions(event.target.value)}
              className="input min-h-24 resize-y"
              placeholder="Liste o que explicitamente não faz parte do projeto."
              disabled={saving}
            />
          </div>
        </div>
      </section>

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link
          href={initialData ? `/dashboard/projetos/${initialData.id}` : '/dashboard/projetos'}
          className="btn-secondary"
        >
          Cancelar
        </Link>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {mode === 'create' ? 'Criar projeto' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}
