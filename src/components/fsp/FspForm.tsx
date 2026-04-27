'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_LABELS,
  FSP_METHOD_TYPE_LABELS,
  FSP_STATUS_LABELS,
  PERFORMANCE_STATUS_LABELS,
  formatDate,
  formatMeasurementValue,
} from '@/lib/utils'
import type {
  Action,
  ActionPriority,
  Fsp,
  FspMethodType,
  FspStatus,
  InsertDto,
  UpdateDto,
  PerformanceStatus,
} from '@/types/database.types'

interface ResponsibleOption {
  id: string
  full_name: string
}

interface ActionOption {
  id: string
  title: string
  status: Action['status']
  due_date: string | null
}

type KpiPeriodSourceContext = {
  sourceType: 'kpi_period'
  projectId: string
  projectName: string
  sourceId: string
  kpiId: string
  kpiName: string
  competence: string
  plannedTarget: number | null
  actualValue: number | null
  calculatedStatus: PerformanceStatus | null
  justification: string | null
  unitOfMeasure: string | null
}

type ActionSourceContext = {
  sourceType: 'action'
  projectId: string
  projectName: string
  sourceId: string
  actionId: string
  actionTitle: string
  actionStatus: Action['status']
  dueDate: string | null
}

type SourceContext = KpiPeriodSourceContext | ActionSourceContext

interface FspFormProps {
  mode: 'create' | 'edit'
  initialData?: Fsp
  sourceContext: SourceContext
  responsibles: ResponsibleOption[]
  actionOptions: ActionOption[]
  existingLinkedAction?: ActionOption | null
  existingGeneratedAction?: ActionOption | null
}

interface FormErrors {
  title?: string
  problem_statement?: string
  selected_action_id?: string
  new_action_title?: string
}

export function FspForm({
  mode,
  initialData,
  sourceContext,
  responsibles,
  actionOptions,
  existingLinkedAction = null,
  existingGeneratedAction = null,
}: FspFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [title, setTitle] = useState(initialData?.title ?? '')
  const [problemStatement, setProblemStatement] = useState(initialData?.problem_statement ?? '')
  const [impact, setImpact] = useState(initialData?.impact ?? '')
  const [evidence, setEvidence] = useState(initialData?.evidence ?? '')
  const [methodType, setMethodType] = useState<FspMethodType>(initialData?.method_type ?? 'structured_analysis')
  const [rootCause, setRootCause] = useState(initialData?.root_cause ?? '')
  const [probableCause, setProbableCause] = useState(initialData?.probable_cause ?? '')
  const [recommendation, setRecommendation] = useState(initialData?.recommendation ?? '')
  const [ownerId, setOwnerId] = useState(initialData?.owner_id ?? '')
  const [status, setStatus] = useState<FspStatus>(initialData?.status ?? 'aberta')

  const [why1, setWhy1] = useState(initialData?.why_1 ?? '')
  const [why2, setWhy2] = useState(initialData?.why_2 ?? '')
  const [why3, setWhy3] = useState(initialData?.why_3 ?? '')
  const [why4, setWhy4] = useState(initialData?.why_4 ?? '')
  const [why5, setWhy5] = useState(initialData?.why_5 ?? '')
  const [fiveWhysConclusion, setFiveWhysConclusion] = useState(initialData?.five_whys_conclusion ?? '')

  const [ishikawaMethod, setIshikawaMethod] = useState(initialData?.ishikawa_method ?? '')
  const [ishikawaLabor, setIshikawaLabor] = useState(initialData?.ishikawa_labor ?? '')
  const [ishikawaMachine, setIshikawaMachine] = useState(initialData?.ishikawa_machine ?? '')
  const [ishikawaMaterial, setIshikawaMaterial] = useState(initialData?.ishikawa_material ?? '')
  const [ishikawaMeasurement, setIshikawaMeasurement] = useState(initialData?.ishikawa_measurement ?? '')
  const [ishikawaEnvironment, setIshikawaEnvironment] = useState(initialData?.ishikawa_environment ?? '')
  const [ishikawaAdditionalNotes, setIshikawaAdditionalNotes] = useState(initialData?.ishikawa_additional_notes ?? '')
  const [ishikawaConclusion, setIshikawaConclusion] = useState(initialData?.ishikawa_conclusion ?? '')

  const [structuredObservedProblem, setStructuredObservedProblem] = useState(initialData?.structured_observed_problem ?? '')
  const [structuredEffectImpact, setStructuredEffectImpact] = useState(initialData?.structured_effect_impact ?? '')
  const [structuredCauseHypothesis, setStructuredCauseHypothesis] = useState(initialData?.structured_cause_hypothesis ?? '')
  const [structuredEvidenceNotes, setStructuredEvidenceNotes] = useState(initialData?.structured_evidence_notes ?? '')
  const [structuredProbableCause, setStructuredProbableCause] = useState(initialData?.structured_probable_cause ?? '')
  const [structuredRootCause, setStructuredRootCause] = useState(initialData?.structured_root_cause ?? '')
  const [structuredRecommendation, setStructuredRecommendation] = useState(initialData?.structured_recommendation ?? '')

  const [actionStrategy, setActionStrategy] = useState<'none' | 'existing' | 'new'>(
    initialData?.generated_action_id
      ? 'new'
      : initialData?.linked_action_id
        ? 'existing'
        : 'none'
  )
  const [selectedActionId, setSelectedActionId] = useState(initialData?.linked_action_id ?? '')
  const [newActionTitle, setNewActionTitle] = useState(
    existingGeneratedAction?.title ??
      `Ação da FSP — ${initialData?.title ?? (sourceContext.sourceType === 'action' ? sourceContext.actionTitle : sourceContext.kpiName)}`
  )
  const [newActionDescription, setNewActionDescription] = useState(recommendation || problemStatement)
  const [newActionAssignedTo, setNewActionAssignedTo] = useState(ownerId)
  const [newActionDueDate, setNewActionDueDate] = useState('')
  const [newActionPriority, setNewActionPriority] = useState<ActionPriority>('high')

  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const methodOptions = useMemo(
    () => Object.entries(FSP_METHOD_TYPE_LABELS) as [FspMethodType, string][],
    []
  )
  const actionStrategyLocked = !!existingGeneratedAction

  const statusOptions = useMemo(
    () => Object.entries(FSP_STATUS_LABELS) as [FspStatus, string][],
    []
  )

  function validate() {
    const nextErrors: FormErrors = {}

    if (!title.trim()) nextErrors.title = 'Informe o título da FSP.'
    if (!problemStatement.trim()) nextErrors.problem_statement = 'Descreva o problema observado.'
    if (actionStrategy === 'existing' && !selectedActionId) {
      nextErrors.selected_action_id = 'Selecione a ação que será vinculada.'
    }
    if (actionStrategy === 'new' && !existingGeneratedAction && !newActionTitle.trim()) {
      nextErrors.new_action_title = 'Informe o título da nova ação.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function upsertFsp(finalStatus: FspStatus) {
    const { data: authData } = await supabase.auth.getUser()
    const payloadBase = {
      title: title.trim(),
      problem_statement: problemStatement.trim(),
      impact: impact.trim() || null,
      evidence: evidence.trim() || null,
      method_type: methodType,
      root_cause: rootCause.trim() || null,
      probable_cause: probableCause.trim() || null,
      recommendation: recommendation.trim() || null,
      owner_id: ownerId || null,
      status: finalStatus,
      closed_at: finalStatus === 'concluida' || finalStatus === 'convertida_em_acao'
        ? initialData?.closed_at ?? new Date().toISOString()
        : null,
      why_1: why1.trim() || null,
      why_2: why2.trim() || null,
      why_3: why3.trim() || null,
      why_4: why4.trim() || null,
      why_5: why5.trim() || null,
      five_whys_conclusion: fiveWhysConclusion.trim() || null,
      ishikawa_method: ishikawaMethod.trim() || null,
      ishikawa_labor: ishikawaLabor.trim() || null,
      ishikawa_machine: ishikawaMachine.trim() || null,
      ishikawa_material: ishikawaMaterial.trim() || null,
      ishikawa_measurement: ishikawaMeasurement.trim() || null,
      ishikawa_environment: ishikawaEnvironment.trim() || null,
      ishikawa_additional_notes: ishikawaAdditionalNotes.trim() || null,
      ishikawa_conclusion: ishikawaConclusion.trim() || null,
      structured_observed_problem: structuredObservedProblem.trim() || null,
      structured_effect_impact: structuredEffectImpact.trim() || null,
      structured_cause_hypothesis: structuredCauseHypothesis.trim() || null,
      structured_evidence_notes: structuredEvidenceNotes.trim() || null,
      structured_probable_cause: structuredProbableCause.trim() || null,
      structured_root_cause: structuredRootCause.trim() || null,
      structured_recommendation: structuredRecommendation.trim() || null,
    }

    const fspsTable = supabase.from('fsps') as any

    if (mode === 'create') {
      const insertPayload: InsertDto<'fsps'> = {
        project_id: sourceContext.projectId,
        source_type: sourceContext.sourceType,
        source_id: sourceContext.sourceId,
        kpi_id: sourceContext.sourceType === 'kpi_period' ? sourceContext.kpiId : null,
        kpi_period_record_id: sourceContext.sourceType === 'kpi_period' ? sourceContext.sourceId : null,
        action_id: sourceContext.sourceType === 'action' ? sourceContext.actionId : null,
        created_by: authData.user?.id ?? null,
        opened_at: new Date().toISOString(),
        ...payloadBase,
      }

      const { data, error } = await fspsTable.insert(insertPayload).select('*').single()
      if (error || !data) {
        throw new Error(error?.message ?? 'Não foi possível criar a FSP.')
      }

      return data as Fsp
    }

    const updatePayload: UpdateDto<'fsps'> = {
      ...payloadBase,
    }

    const { data, error } = await fspsTable
      .update(updatePayload)
      .eq('id', initialData!.id)
      .select('*')
      .single()

    if (error || !data) {
      throw new Error(error?.message ?? 'Não foi possível atualizar a FSP.')
    }

    return data as Fsp
  }

  async function handleActionLink(fsp: Fsp, authUserId: string | null) {
    const actionsTable = supabase.from('actions') as any
    const fspsTable = supabase.from('fsps') as any

    if (initialData?.linked_action_id && actionStrategy !== 'existing') {
      await actionsTable.update({ fsp_id: null }).eq('id', initialData.linked_action_id)
      await fspsTable.update({ linked_action_id: null }).eq('id', fsp.id)
    }

    if (actionStrategy === 'none') {
      return
    }

    if (actionStrategy === 'existing' && selectedActionId) {
      const { error: actionError } = await actionsTable
        .update({
          fsp_id: fsp.id,
          action_origin: 'fsp',
          kpi_id: sourceContext.sourceType === 'kpi_period' ? sourceContext.kpiId : null,
          kpi_period_record_id: sourceContext.sourceType === 'kpi_period' ? sourceContext.sourceId : null,
        })
        .eq('id', selectedActionId)

      if (actionError) {
        throw new Error(actionError.message ?? 'Não foi possível vincular a ação existente.')
      }

      const { error: fspError } = await fspsTable
        .update({
          linked_action_id: selectedActionId,
          status: 'convertida_em_acao',
          closed_at: new Date().toISOString(),
        })
        .eq('id', fsp.id)

      if (fspError) {
        throw new Error(fspError.message ?? 'Não foi possível atualizar o vínculo da FSP.')
      }
    }

    if (actionStrategy === 'new' && !existingGeneratedAction) {
      const actionTitleValue = newActionTitle.trim() || `Ação da FSP — ${fsp.title}`
      const actionDescriptionValue =
        newActionDescription.trim() ||
        recommendation.trim() ||
        problemStatement.trim()

      const insertPayload: InsertDto<'actions'> = {
        project_id: sourceContext.projectId,
        title: actionTitleValue,
        description: actionDescriptionValue,
        assigned_to: newActionAssignedTo || null,
        action_origin: 'fsp',
        fsp_id: fsp.id,
        kpi_id: sourceContext.sourceType === 'kpi_period' ? sourceContext.kpiId : null,
        kpi_period_record_id: sourceContext.sourceType === 'kpi_period' ? sourceContext.sourceId : null,
        due_date: newActionDueDate || null,
        priority: newActionPriority,
        status: 'not_started',
        classification: 'strategic',
        notes: recommendation.trim() || null,
        visible_to_client: false,
        created_by: authUserId,
      }

      const { data, error } = await actionsTable.insert(insertPayload).select('id').single()
      if (error || !data) {
        throw new Error(error?.message ?? 'Não foi possível gerar a ação a partir da FSP.')
      }

      const generatedActionId = (data as { id: string }).id

      const { error: fspError } = await fspsTable
        .update({
          generated_action_id: generatedActionId,
          status: 'convertida_em_acao',
          closed_at: new Date().toISOString(),
        })
        .eq('id', fsp.id)

      if (fspError) {
        throw new Error(fspError.message ?? 'Não foi possível gravar a ação gerada na FSP.')
      }
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!validate()) return

    setSaving(true)

    try {
      const { data: authData } = await supabase.auth.getUser()
      const finalStatus =
        actionStrategy === 'none' && !existingGeneratedAction
          ? status
          : 'convertida_em_acao'
      const savedFsp = await upsertFsp(finalStatus)

      await handleActionLink(savedFsp, authData.user?.id ?? null)

      router.push(`/dashboard/fsps/${savedFsp.id}`)
      router.refresh()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a FSP. Tente novamente.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-neutral-900">Contexto da origem</h2>

        {sourceContext.sourceType === 'kpi_period' ? (
          <div className="grid gap-4 md:grid-cols-2 text-sm text-neutral-700">
            <div>
              <p className="mb-1 text-xs text-neutral-400">Projeto</p>
              <p>{sourceContext.projectName}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-neutral-400">KPI</p>
              <p>{sourceContext.kpiName}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-neutral-400">Competência</p>
              <p>{sourceContext.competence}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-neutral-400">Farol</p>
              <p>{sourceContext.calculatedStatus ? PERFORMANCE_STATUS_LABELS[sourceContext.calculatedStatus] : 'Sem farol'}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-neutral-400">Meta</p>
              <p>{formatMeasurementValue(sourceContext.plannedTarget, sourceContext.unitOfMeasure)}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-neutral-400">Realizado</p>
              <p>{formatMeasurementValue(sourceContext.actualValue, sourceContext.unitOfMeasure)}</p>
            </div>
            <div className="md:col-span-2">
              <p className="mb-1 text-xs text-neutral-400">Justificativa da apuração</p>
              <p className="whitespace-pre-wrap">{sourceContext.justification ?? 'Sem justificativa registrada.'}</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 text-sm text-neutral-700">
            <div>
              <p className="mb-1 text-xs text-neutral-400">Projeto</p>
              <p>{sourceContext.projectName}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-neutral-400">Ação de origem</p>
              <p>{sourceContext.actionTitle}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-neutral-400">Status</p>
              <p>{ACTION_STATUS_LABELS[sourceContext.actionStatus]}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-neutral-400">Prazo</p>
              <p>{formatDate(sourceContext.dueDate)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="card p-6 space-y-5">
        <h2 className="text-sm font-semibold text-neutral-900">Estrutura da FSP</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="title" className="label">Título *</label>
            <input id="title" value={title} onChange={e => setTitle(e.target.value)} className="input" disabled={saving} />
            {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
          </div>

          <div>
            <label htmlFor="method_type" className="label">Método de análise</label>
            <select id="method_type" value={methodType} onChange={e => setMethodType(e.target.value as FspMethodType)} className="input" disabled={saving}>
              {methodOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="owner_id" className="label">Responsável</label>
            <select id="owner_id" value={ownerId} onChange={e => setOwnerId(e.target.value)} className="input" disabled={saving}>
              <option value="">Não definido</option>
              {responsibles.map(option => (
                <option key={option.id} value={option.id}>{option.full_name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="problem_statement" className="label">Problema observado *</label>
            <textarea id="problem_statement" value={problemStatement} onChange={e => setProblemStatement(e.target.value)} className="input min-h-28 resize-y" disabled={saving} />
            {errors.problem_statement && <p className="mt-1 text-xs text-red-600">{errors.problem_statement}</p>}
          </div>

          <div>
            <label htmlFor="impact" className="label">Impacto</label>
            <textarea id="impact" value={impact} onChange={e => setImpact(e.target.value)} className="input min-h-24 resize-y" disabled={saving} />
          </div>

          <div>
            <label htmlFor="evidence" className="label">Evidência</label>
            <textarea id="evidence" value={evidence} onChange={e => setEvidence(e.target.value)} className="input min-h-24 resize-y" disabled={saving} />
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-5">
        <h2 className="text-sm font-semibold text-neutral-900">Análise</h2>

        {methodType === 'five_whys' && (
          <div className="grid gap-4 md:grid-cols-2">
            {[['why_1', why1, setWhy1], ['why_2', why2, setWhy2], ['why_3', why3, setWhy3], ['why_4', why4, setWhy4], ['why_5', why5, setWhy5]].map(([id, value, setter], index) => (
              <div key={id as string} className={index === 4 ? 'md:col-span-2' : ''}>
                <label htmlFor={id as string} className="label">Porquê {index + 1}</label>
                <textarea id={id as string} value={value as string} onChange={e => (setter as (value: string) => void)(e.target.value)} className="input min-h-24 resize-y" disabled={saving} />
              </div>
            ))}
            <div className="md:col-span-2">
              <label htmlFor="five_whys_conclusion" className="label">Conclusão</label>
              <textarea id="five_whys_conclusion" value={fiveWhysConclusion} onChange={e => setFiveWhysConclusion(e.target.value)} className="input min-h-24 resize-y" disabled={saving} />
            </div>
          </div>
        )}

        {methodType === 'ishikawa' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div><label htmlFor="ishikawa_method" className="label">Método</label><textarea id="ishikawa_method" value={ishikawaMethod} onChange={e => setIshikawaMethod(e.target.value)} className="input min-h-24 resize-y" disabled={saving} /></div>
            <div><label htmlFor="ishikawa_labor" className="label">Mão de obra</label><textarea id="ishikawa_labor" value={ishikawaLabor} onChange={e => setIshikawaLabor(e.target.value)} className="input min-h-24 resize-y" disabled={saving} /></div>
            <div><label htmlFor="ishikawa_machine" className="label">Máquina</label><textarea id="ishikawa_machine" value={ishikawaMachine} onChange={e => setIshikawaMachine(e.target.value)} className="input min-h-24 resize-y" disabled={saving} /></div>
            <div><label htmlFor="ishikawa_material" className="label">Material</label><textarea id="ishikawa_material" value={ishikawaMaterial} onChange={e => setIshikawaMaterial(e.target.value)} className="input min-h-24 resize-y" disabled={saving} /></div>
            <div><label htmlFor="ishikawa_measurement" className="label">Medição</label><textarea id="ishikawa_measurement" value={ishikawaMeasurement} onChange={e => setIshikawaMeasurement(e.target.value)} className="input min-h-24 resize-y" disabled={saving} /></div>
            <div><label htmlFor="ishikawa_environment" className="label">Meio ambiente</label><textarea id="ishikawa_environment" value={ishikawaEnvironment} onChange={e => setIshikawaEnvironment(e.target.value)} className="input min-h-24 resize-y" disabled={saving} /></div>
            <div className="md:col-span-2"><label htmlFor="ishikawa_additional_notes" className="label">Notas adicionais</label><textarea id="ishikawa_additional_notes" value={ishikawaAdditionalNotes} onChange={e => setIshikawaAdditionalNotes(e.target.value)} className="input min-h-24 resize-y" disabled={saving} /></div>
            <div className="md:col-span-2"><label htmlFor="ishikawa_conclusion" className="label">Conclusão</label><textarea id="ishikawa_conclusion" value={ishikawaConclusion} onChange={e => setIshikawaConclusion(e.target.value)} className="input min-h-24 resize-y" disabled={saving} /></div>
          </div>
        )}

        {methodType === 'structured_analysis' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div><label htmlFor="structured_observed_problem" className="label">Problema observado</label><textarea id="structured_observed_problem" value={structuredObservedProblem} onChange={e => setStructuredObservedProblem(e.target.value)} className="input min-h-24 resize-y" disabled={saving} /></div>
            <div><label htmlFor="structured_effect_impact" className="label">Efeito / impacto</label><textarea id="structured_effect_impact" value={structuredEffectImpact} onChange={e => setStructuredEffectImpact(e.target.value)} className="input min-h-24 resize-y" disabled={saving} /></div>
            <div><label htmlFor="structured_cause_hypothesis" className="label">Hipótese de causa</label><textarea id="structured_cause_hypothesis" value={structuredCauseHypothesis} onChange={e => setStructuredCauseHypothesis(e.target.value)} className="input min-h-24 resize-y" disabled={saving} /></div>
            <div><label htmlFor="structured_evidence_notes" className="label">Notas de evidência</label><textarea id="structured_evidence_notes" value={structuredEvidenceNotes} onChange={e => setStructuredEvidenceNotes(e.target.value)} className="input min-h-24 resize-y" disabled={saving} /></div>
            <div><label htmlFor="structured_probable_cause" className="label">Causa provável</label><textarea id="structured_probable_cause" value={structuredProbableCause} onChange={e => setStructuredProbableCause(e.target.value)} className="input min-h-24 resize-y" disabled={saving} /></div>
            <div><label htmlFor="structured_root_cause" className="label">Causa raiz</label><textarea id="structured_root_cause" value={structuredRootCause} onChange={e => setStructuredRootCause(e.target.value)} className="input min-h-24 resize-y" disabled={saving} /></div>
            <div className="md:col-span-2"><label htmlFor="structured_recommendation" className="label">Recomendação</label><textarea id="structured_recommendation" value={structuredRecommendation} onChange={e => setStructuredRecommendation(e.target.value)} className="input min-h-24 resize-y" disabled={saving} /></div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="probable_cause" className="label">Causa provável consolidada</label>
            <textarea id="probable_cause" value={probableCause} onChange={e => setProbableCause(e.target.value)} className="input min-h-24 resize-y" disabled={saving} />
          </div>
          <div>
            <label htmlFor="root_cause" className="label">Causa raiz consolidada</label>
            <textarea id="root_cause" value={rootCause} onChange={e => setRootCause(e.target.value)} className="input min-h-24 resize-y" disabled={saving} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="recommendation" className="label">Recomendação</label>
            <textarea id="recommendation" value={recommendation} onChange={e => { setRecommendation(e.target.value); setNewActionDescription(e.target.value) }} className="input min-h-24 resize-y" disabled={saving} />
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-5">
        <h2 className="text-sm font-semibold text-neutral-900">Desdobramento</h2>

        <div className="grid gap-3">
          {[
            ['none', 'Concluir sem ação'],
            ['existing', 'Vincular ação existente'],
            ['new', 'Gerar nova ação'],
          ].map(([value, label]) => (
            <label key={value} className="flex items-center gap-3 text-sm text-neutral-700">
              <input
                type="radio"
                name="action_strategy"
                value={value}
                checked={actionStrategy === value}
                onChange={() => setActionStrategy(value as 'none' | 'existing' | 'new')}
                disabled={saving || actionStrategyLocked}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {existingGeneratedAction && (
          <p className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-800">
            Esta FSP já gerou a ação{' '}
            <Link href={`/dashboard/acoes/${existingGeneratedAction.id}`} className="font-medium underline underline-offset-4">
              {existingGeneratedAction.title}
            </Link>
            .
          </p>
        )}

        {actionStrategy === 'existing' && (
          <div>
            <label htmlFor="linked_action_id" className="label">Ação existente</label>
            <select id="linked_action_id" value={selectedActionId} onChange={e => setSelectedActionId(e.target.value)} className="input" disabled={saving}>
              <option value="">Selecione</option>
              {actionOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.title} • {ACTION_STATUS_LABELS[option.status]}
                </option>
              ))}
            </select>
            {errors.selected_action_id && <p className="mt-1 text-xs text-red-600">{errors.selected_action_id}</p>}
            {existingLinkedAction && (
              <p className="mt-2 text-xs text-neutral-500">
                Ação atualmente vinculada: {existingLinkedAction.title}
              </p>
            )}
          </div>
        )}

        {actionStrategy === 'new' && !existingGeneratedAction && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="new_action_title" className="label">Título da nova ação</label>
              <input id="new_action_title" value={newActionTitle} onChange={e => setNewActionTitle(e.target.value)} className="input" disabled={saving} />
              {errors.new_action_title && <p className="mt-1 text-xs text-red-600">{errors.new_action_title}</p>}
            </div>
            <div className="md:col-span-2">
              <label htmlFor="new_action_description" className="label">Descrição da nova ação</label>
              <textarea id="new_action_description" value={newActionDescription} onChange={e => setNewActionDescription(e.target.value)} className="input min-h-24 resize-y" disabled={saving} />
            </div>
            <div>
              <label htmlFor="new_action_assigned_to" className="label">Responsável da ação</label>
              <select id="new_action_assigned_to" value={newActionAssignedTo} onChange={e => setNewActionAssignedTo(e.target.value)} className="input" disabled={saving}>
                <option value="">Não definido</option>
                {responsibles.map(option => (
                  <option key={option.id} value={option.id}>{option.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="new_action_due_date" className="label">Prazo da ação</label>
              <input id="new_action_due_date" type="date" value={newActionDueDate} onChange={e => setNewActionDueDate(e.target.value)} className="input" disabled={saving} />
            </div>
            <div>
              <label htmlFor="new_action_priority" className="label">Prioridade da ação</label>
              <select id="new_action_priority" value={newActionPriority} onChange={e => setNewActionPriority(e.target.value as ActionPriority)} className="input" disabled={saving}>
                {Object.entries(ACTION_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="status" className="label">Status da FSP</label>
          <select id="status" value={status} onChange={e => setStatus(e.target.value as FspStatus)} className="input" disabled={saving || actionStrategy !== 'none'}>
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {formError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Link href={mode === 'edit' && initialData ? `/dashboard/fsps/${initialData.id}` : '/dashboard/fsps'} className="btn-secondary">
          Cancelar
        </Link>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving && <Loader2 size={16} className="animate-spin" />}
          {mode === 'create' ? 'Criar FSP' : 'Salvar FSP'}
        </button>
      </div>
    </form>
  )
}
