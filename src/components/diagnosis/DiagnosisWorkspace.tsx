'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Plus, Save } from 'lucide-react'
import { RateFausCard } from '@/components/diagnosis/RateFausCard'
import { createClient } from '@/lib/supabase/client'
import {
  ACTION_PRIORITY_LABELS,
  DIAGNOSIS_AREA_OPTIONS,
  DIAGNOSIS_STATUS_LABELS,
  DIAGNOSIS_UNIT_OPTIONS,
  formatMeasurementValue,
} from '@/lib/utils'
import type {
  ActionPriority,
  DiagnosisIndicator,
  DiagnosisStatus,
  InsertDto,
  Profile,
  Project,
  ProjectDiagnosis,
  RateAssessment,
  RateAssessmentItem,
  RateAssessmentVersion,
  UpdateDto,
} from '@/types/database.types'

interface ResponsibleOption {
  id: string
  full_name: string
}

interface DiagnosisWorkspaceProps {
  project: Pick<Project, 'id' | 'project_name'>
  diagnosis: ProjectDiagnosis | null
  indicators: DiagnosisIndicator[]
  responsibles: ResponsibleOption[]
  rateFeatureEnabled: boolean
  isAdmin: boolean
  canEdit: boolean
  rateSummary: {
    assessment: RateAssessment
    latestVersion: RateAssessmentVersion | null
    versionCount: number
    versions: RateAssessmentVersion[]
    items: RateAssessmentItem[]
  } | null
}

interface DiagnosisErrors {
  visible_to_client?: string
}

interface IndicatorErrors {
  area?: string
  indicator_name?: string
}

export function DiagnosisWorkspace({
  project,
  diagnosis,
  indicators,
  responsibles,
  rateFeatureEnabled,
  isAdmin,
  canEdit,
  rateSummary,
}: DiagnosisWorkspaceProps) {
  const router = useRouter()
  const supabase = createClient()

  const [diagnosisId, setDiagnosisId] = useState(diagnosis?.id ?? null)
  const [startDate, setStartDate] = useState(diagnosis?.start_date ?? '')
  const [endDate, setEndDate] = useState(diagnosis?.end_date ?? '')
  const [ownerId, setOwnerId] = useState(diagnosis?.owner_id ?? '')
  const [executiveSummary, setExecutiveSummary] = useState(diagnosis?.executive_summary ?? '')
  const [keyFindings, setKeyFindings] = useState(diagnosis?.key_findings ?? '')
  const [initialHypotheses, setInitialHypotheses] = useState(diagnosis?.initial_hypotheses ?? '')
  const [status, setStatus] = useState<DiagnosisStatus>(diagnosis?.status ?? 'em_elaboracao')
  const [visibleToClient, setVisibleToClient] = useState(diagnosis?.visible_to_client ?? false)
  const [diagnosisErrors, setDiagnosisErrors] = useState<DiagnosisErrors>({})
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null)
  const [diagnosisSaving, setDiagnosisSaving] = useState(false)

  const [editingIndicatorId, setEditingIndicatorId] = useState<string | null>(null)
  const [area, setArea] = useState('')
  const [indicatorName, setIndicatorName] = useState('')
  const [unitOfMeasure, setUnitOfMeasure] = useState('')
  const [baselineValue, setBaselineValue] = useState('')
  const [rationale, setRationale] = useState('')
  const [indicatorNotes, setIndicatorNotes] = useState('')
  const [referenceDate, setReferenceDate] = useState('')
  const [priority, setPriority] = useState<ActionPriority>('medium')
  const [isActive, setIsActive] = useState(true)
  const [indicatorErrors, setIndicatorErrors] = useState<IndicatorErrors>({})
  const [indicatorError, setIndicatorError] = useState<string | null>(null)
  const [indicatorSaving, setIndicatorSaving] = useState(false)

  const statusOptions = useMemo(
    () => Object.entries(DIAGNOSIS_STATUS_LABELS) as [DiagnosisStatus, string][],
    []
  )

  const priorityOptions = useMemo(
    () => Object.entries(ACTION_PRIORITY_LABELS) as [ActionPriority, string][],
    []
  )

  function validateDiagnosis() {
    const nextErrors: DiagnosisErrors = {}

    if (visibleToClient && status === 'em_elaboracao') {
      nextErrors.visible_to_client = 'Conclua ou revise o diagnóstico antes de liberar ao cliente.'
    }

    setDiagnosisErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleDiagnosisSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDiagnosisError(null)

    if (!validateDiagnosis()) return

    setDiagnosisSaving(true)

    try {
      const diagnosesTable = supabase.from('project_diagnoses') as any

      const { data: authData } = await supabase.auth.getUser()

      if (!diagnosisId) {
        const insertPayload: InsertDto<'project_diagnoses'> = {
          project_id: project.id,
          start_date: startDate || null,
          end_date: endDate || null,
          owner_id: ownerId || null,
          executive_summary: executiveSummary.trim() || null,
          key_findings: keyFindings.trim() || null,
          initial_hypotheses: initialHypotheses.trim() || null,
          status,
          visible_to_client: visibleToClient,
          created_by: authData.user?.id ?? null,
        }

        const { data, error } = await diagnosesTable
          .insert(insertPayload)
          .select('id')
          .single()

        if (error || !data) {
          throw new Error(error?.message ?? 'Não foi possível criar o diagnóstico.')
        }

        setDiagnosisId((data as { id: string }).id)
      } else {
        const updatePayload: UpdateDto<'project_diagnoses'> = {
          start_date: startDate || null,
          end_date: endDate || null,
          owner_id: ownerId || null,
          executive_summary: executiveSummary.trim() || null,
          key_findings: keyFindings.trim() || null,
          initial_hypotheses: initialHypotheses.trim() || null,
          status,
          visible_to_client: visibleToClient,
        }

        const { error } = await diagnosesTable
          .update(updatePayload)
          .eq('id', diagnosisId)

        if (error) {
          throw new Error(error.message)
        }
      }

      router.refresh()
    } catch (error) {
      setDiagnosisError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o diagnóstico. Tente novamente.'
      )
    } finally {
      setDiagnosisSaving(false)
    }
  }

  function resetIndicatorForm() {
    setEditingIndicatorId(null)
    setArea('')
    setIndicatorName('')
    setUnitOfMeasure('')
    setBaselineValue('')
    setRationale('')
    setIndicatorNotes('')
    setReferenceDate('')
    setPriority('medium')
    setIsActive(true)
    setIndicatorErrors({})
    setIndicatorError(null)
  }

  function validateIndicator() {
    const nextErrors: IndicatorErrors = {}

    if (!area.trim()) nextErrors.area = 'Informe a área do indicador.'
    if (!indicatorName.trim()) nextErrors.indicator_name = 'Informe o nome do indicador.'

    setIndicatorErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function startEditingIndicator(indicator: DiagnosisIndicator) {
    setEditingIndicatorId(indicator.id)
    setArea(indicator.area)
    setIndicatorName(indicator.indicator_name)
    setUnitOfMeasure(indicator.unit_of_measure ?? '')
    setBaselineValue(indicator.baseline_value?.toString() ?? '')
    setRationale(indicator.rationale ?? '')
    setIndicatorNotes(indicator.notes ?? '')
    setReferenceDate(indicator.reference_date ?? '')
    setPriority(indicator.priority)
    setIsActive(indicator.is_active)
    setIndicatorErrors({})
    setIndicatorError(null)
  }

  async function handleIndicatorSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIndicatorError(null)

    if (!diagnosisId) {
      setIndicatorError('Salve o diagnóstico principal antes de cadastrar indicadores-base.')
      return
    }

    if (!validateIndicator()) return

    setIndicatorSaving(true)

    try {
      const indicatorsTable = supabase.from('diagnosis_indicators') as any

      if (editingIndicatorId) {
        const updatePayload: UpdateDto<'diagnosis_indicators'> = {
          area: area.trim(),
          indicator_name: indicatorName.trim(),
          unit_of_measure: unitOfMeasure.trim() || null,
          baseline_value: baselineValue === '' ? null : Number(baselineValue),
          rationale: rationale.trim() || null,
          notes: indicatorNotes.trim() || null,
          reference_date: referenceDate || null,
          priority,
          is_active: isActive,
        }

        const { error } = await indicatorsTable
          .update(updatePayload)
          .eq('id', editingIndicatorId)

        if (error) throw new Error(error.message)
      } else {
        const insertPayload: InsertDto<'diagnosis_indicators'> = {
          diagnosis_id: diagnosisId,
          project_id: project.id,
          area: area.trim(),
          indicator_name: indicatorName.trim(),
          unit_of_measure: unitOfMeasure.trim() || null,
          baseline_value: baselineValue === '' ? null : Number(baselineValue),
          rationale: rationale.trim() || null,
          notes: indicatorNotes.trim() || null,
          reference_date: referenceDate || null,
          priority,
          is_active: isActive,
        }

        const { error } = await indicatorsTable
          .insert(insertPayload)

        if (error) throw new Error(error.message)
      }

      resetIndicatorForm()
      router.refresh()
    } catch (error) {
      setIndicatorError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o indicador-base. Tente novamente.'
      )
    } finally {
      setIndicatorSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleDiagnosisSubmit} className="card p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Diagnóstico principal</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Registre o diagnóstico-base do projeto e controle a liberação ao cliente.
            </p>
          </div>
          <Link href={`/dashboard/projetos/${project.id}`} className="btn-secondary">
            Voltar ao projeto
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="diagnosis_start_date" className="label">Início</label>
            <input
              id="diagnosis_start_date"
              type="date"
              className="input"
              value={startDate}
              onChange={event => setStartDate(event.target.value)}
            disabled={diagnosisSaving || !canEdit}
            />
          </div>

          <div>
            <label htmlFor="diagnosis_end_date" className="label">Fim</label>
            <input
              id="diagnosis_end_date"
              type="date"
              className="input"
              value={endDate}
              onChange={event => setEndDate(event.target.value)}
            disabled={diagnosisSaving || !canEdit}
            />
          </div>

          <div>
            <label htmlFor="diagnosis_owner" className="label">Responsável</label>
            <select
              id="diagnosis_owner"
              className="input"
              value={ownerId}
              onChange={event => setOwnerId(event.target.value)}
              disabled={diagnosisSaving || !canEdit}
            >
              <option value="">Não definido</option>
              {responsibles.map(responsible => (
                <option key={responsible.id} value={responsible.id}>
                  {responsible.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="diagnosis_status" className="label">Status</label>
            <select
              id="diagnosis_status"
              className="input"
              value={status}
              onChange={event => setStatus(event.target.value as DiagnosisStatus)}
              disabled={diagnosisSaving || !canEdit}
            >
              {statusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="diagnosis_summary" className="label">Resumo executivo</label>
            <textarea
              id="diagnosis_summary"
              className="input min-h-28"
              value={executiveSummary}
              onChange={event => setExecutiveSummary(event.target.value)}
              disabled={diagnosisSaving || !canEdit}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="diagnosis_findings" className="label">Principais achados</label>
            <textarea
              id="diagnosis_findings"
              className="input min-h-28"
              value={keyFindings}
              onChange={event => setKeyFindings(event.target.value)}
              disabled={diagnosisSaving || !canEdit}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="diagnosis_hypotheses" className="label">Hipóteses iniciais</label>
            <textarea
              id="diagnosis_hypotheses"
              className="input min-h-28"
              value={initialHypotheses}
              onChange={event => setInitialHypotheses(event.target.value)}
              disabled={diagnosisSaving || !canEdit}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              checked={visibleToClient}
              onChange={event => setVisibleToClient(event.target.checked)}
              disabled={diagnosisSaving || !canEdit}
            />
            <span>
              <span className="block text-sm font-medium text-neutral-900">
                Liberar diagnóstico para o portal do cliente
              </span>
              <span className="mt-1 block text-xs text-neutral-500">
                O diagnóstico nasce interno por padrão. A liberação só deve ocorrer após conclusão ou revisão.
              </span>
            </span>
          </label>
          {diagnosisErrors.visible_to_client && (
            <p className="mt-2 text-xs text-red-600">{diagnosisErrors.visible_to_client}</p>
          )}
        </div>

        {diagnosisError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {diagnosisError}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button type="submit" className="btn-primary" disabled={diagnosisSaving || !canEdit}>
            {diagnosisSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Salvando
              </>
            ) : (
              <>
                <Save size={16} />
                {diagnosisId ? 'Salvar diagnóstico' : 'Criar diagnóstico'}
              </>
            )}
          </button>
        </div>
      </form>

      <RateFausCard
        projectId={project.id}
        diagnosisId={diagnosisId}
        featureEnabled={rateFeatureEnabled}
        canEdit={canEdit}
        canReset={isAdmin}
        summary={rateSummary}
      />

      <div className="card p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Indicadores-base do diagnóstico</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Registre a linha de base por área, com valor inicial, racional e data de referência.
            </p>
          </div>
          {diagnosisId ? (
            <span className="badge bg-brand-50 text-brand-700">Diagnóstico salvo</span>
          ) : (
            <span className="badge bg-neutral-100 text-neutral-500">Salve o diagnóstico para habilitar</span>
          )}
        </div>

        <form onSubmit={handleIndicatorSubmit} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="indicator_area" className="label">Área *</label>
              <select
                id="indicator_area"
                className="input"
                value={area}
                onChange={event => setArea(event.target.value)}
                disabled={indicatorSaving || !diagnosisId || !canEdit}
              >
                <option value="">Selecione</option>
                {DIAGNOSIS_AREA_OPTIONS.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {indicatorErrors.area && <p className="mt-1 text-xs text-red-600">{indicatorErrors.area}</p>}
            </div>

            <div>
              <label htmlFor="indicator_name" className="label">Indicador-base *</label>
              <input
                id="indicator_name"
                className="input"
                value={indicatorName}
                onChange={event => setIndicatorName(event.target.value)}
                disabled={indicatorSaving || !diagnosisId || !canEdit}
              />
              {indicatorErrors.indicator_name && <p className="mt-1 text-xs text-red-600">{indicatorErrors.indicator_name}</p>}
            </div>

            <div>
              <label htmlFor="indicator_unit" className="label">Unidade de medida</label>
              <select
                id="indicator_unit"
                className="input"
                value={unitOfMeasure}
                onChange={event => setUnitOfMeasure(event.target.value)}
                disabled={indicatorSaving || !diagnosisId || !canEdit}
              >
                <option value="">Sem unidade</option>
                {DIAGNOSIS_UNIT_OPTIONS.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="indicator_baseline" className="label">Valor inicial</label>
              <input
                id="indicator_baseline"
                type="number"
                step="0.01"
                className="input"
                value={baselineValue}
                onChange={event => setBaselineValue(event.target.value)}
                disabled={indicatorSaving || !diagnosisId || !canEdit}
              />
            </div>

            <div>
              <label htmlFor="indicator_reference_date" className="label">Data de referência</label>
              <input
                id="indicator_reference_date"
                type="date"
                className="input"
                value={referenceDate}
                onChange={event => setReferenceDate(event.target.value)}
                disabled={indicatorSaving || !diagnosisId || !canEdit}
              />
            </div>

            <div>
              <label htmlFor="indicator_priority" className="label">Prioridade</label>
              <select
                id="indicator_priority"
                className="input"
                value={priority}
                onChange={event => setPriority(event.target.value as ActionPriority)}
                disabled={indicatorSaving || !diagnosisId || !canEdit}
              >
                {priorityOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="indicator_rationale" className="label">Racional</label>
              <textarea
                id="indicator_rationale"
                className="input min-h-24"
                value={rationale}
                onChange={event => setRationale(event.target.value)}
                disabled={indicatorSaving || !diagnosisId || !canEdit}
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="indicator_notes" className="label">Observações</label>
              <textarea
                id="indicator_notes"
                className="input min-h-24"
                value={indicatorNotes}
                onChange={event => setIndicatorNotes(event.target.value)}
                disabled={indicatorSaving || !diagnosisId || !canEdit}
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              checked={isActive}
              onChange={event => setIsActive(event.target.checked)}
              disabled={indicatorSaving || !diagnosisId || !canEdit}
            />
            Indicador ativo
          </label>

          {indicatorError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {indicatorError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            {editingIndicatorId && (
              <button type="button" className="btn-secondary" onClick={resetIndicatorForm} disabled={indicatorSaving}>
                Cancelar edição
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={indicatorSaving || !diagnosisId || !canEdit}>
              {indicatorSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvando
                </>
              ) : (
                <>
                  {editingIndicatorId ? <Pencil size={16} /> : <Plus size={16} />}
                  {editingIndicatorId ? 'Salvar indicador' : 'Adicionar indicador'}
                </>
              )}
            </button>
          </div>
        </form>

        <div className="overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-3">Área</th>
                <th className="px-4 py-3">Indicador</th>
                <th className="px-4 py-3">Baseline</th>
                <th className="px-4 py-3">Referência</th>
                <th className="px-4 py-3">Prioridade</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {indicators.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-neutral-500">
                    Nenhum indicador-base registrado até o momento.
                  </td>
                </tr>
              ) : (
                indicators.map(indicator => (
                  <tr key={indicator.id}>
                    <td className="px-4 py-3 text-neutral-700">{indicator.area}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-900">{indicator.indicator_name}</div>
                      {indicator.unit_of_measure && (
                        <div className="text-xs text-neutral-400">{indicator.unit_of_measure}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {formatMeasurementValue(indicator.baseline_value, indicator.unit_of_measure)}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {indicator.reference_date
                        ? new Intl.DateTimeFormat('pt-BR').format(new Date(indicator.reference_date))
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{ACTION_PRIORITY_LABELS[indicator.priority]}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${indicator.is_active ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {indicator.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canEdit ? (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => startEditingIndicator(indicator)}
                        >
                          Editar
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-400">Somente leitura</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
