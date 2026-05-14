'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  KPI_CLASSIFICATION_LABELS,
  KPI_FREQUENCY_LABELS,
  KPI_ORIGIN_TYPE_LABELS,
  KPI_READING_TYPE_LABELS,
  KPI_STATUS_LABELS,
  KPI_TREND_LABELS,
} from '@/lib/utils'
import type {
  DiagnosisIndicator,
  InsertDto,
  Kpi,
  KpiClassification,
  KpiFrequency,
  KpiOriginType,
  KpiReadingType,
  KpiStatus,
  KpiTrend,
  Profile,
  Project,
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

interface KpiFormProps {
  mode: 'create' | 'edit'
  initialData?: Kpi
  projects: ProjectOption[]
  responsibles: ResponsibleOption[]
  diagnosisIndicators: Array<
    Pick<DiagnosisIndicator, 'id' | 'project_id' | 'area' | 'indicator_name' | 'baseline_value' | 'reference_date'>
  >
  diagnosisFeatureEnabled?: boolean
  canChooseProject: boolean
  canEditUnitOfMeasure?: boolean
  canEditStructuralFields?: boolean
}

interface FormErrors {
  project_id?: string
  kpi_name?: string
  diagnosis_indicator_id?: string
}

type KpiUpdatePayload = UpdateDto<'kpis'> & {
  unit_of_measure?: string | null
}

export function KpiForm({
  mode,
  initialData,
  projects,
  responsibles,
  diagnosisIndicators,
  diagnosisFeatureEnabled = true,
  canChooseProject,
  canEditUnitOfMeasure = false,
  canEditStructuralFields = mode === 'create',
}: KpiFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [projectId, setProjectId] = useState(initialData?.project_id ?? projects[0]?.id ?? '')
  const [kpiName, setKpiName] = useState(initialData?.kpi_name ?? '')
  const [category, setCategory] = useState(initialData?.category ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [classification, setClassification] = useState<KpiClassification>(initialData?.classification ?? 'primary')
  const [unitOfMeasure, setUnitOfMeasure] = useState(initialData?.unit_of_measure ?? '')
  const [targetValue, setTargetValue] = useState(initialData?.target_value?.toString() ?? '')
  const [currentValue, setCurrentValue] = useState(initialData?.current_value?.toString() ?? '')
  const [updateFrequency, setUpdateFrequency] = useState<KpiFrequency>(initialData?.update_frequency ?? 'monthly')
  const [responsibleId, setResponsibleId] = useState(initialData?.responsible_id ?? '')
  const [readingType, setReadingType] = useState<KpiReadingType>(initialData?.reading_type ?? 'higher_is_better')
  const [status, setStatus] = useState<KpiStatus>(initialData?.status ?? 'no_update')
  const [trend, setTrend] = useState<KpiTrend | ''>(initialData?.trend ?? '')
  const [originType, setOriginType] = useState<KpiOriginType>(initialData?.origin_type ?? 'project_defined')
  const [diagnosisIndicatorId, setDiagnosisIndicatorId] = useState(initialData?.diagnosis_indicator_id ?? '')
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [visibleToClient, setVisibleToClient] = useState(initialData?.visible_to_client ?? false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const classificationOptions = useMemo(
    () => Object.entries(KPI_CLASSIFICATION_LABELS) as [KpiClassification, string][],
    []
  )
  const frequencyOptions = useMemo(
    () => Object.entries(KPI_FREQUENCY_LABELS) as [KpiFrequency, string][],
    []
  )
  const statusOptions = useMemo(
    () => Object.entries(KPI_STATUS_LABELS) as [KpiStatus, string][],
    []
  )
  const trendOptions = useMemo(
    () => Object.entries(KPI_TREND_LABELS) as [KpiTrend, string][],
    []
  )
  const originTypeOptions = useMemo(
    () => Object.entries(KPI_ORIGIN_TYPE_LABELS) as [KpiOriginType, string][],
    []
  )
  const readingTypeOptions = useMemo(
    () => Object.entries(KPI_READING_TYPE_LABELS) as [KpiReadingType, string][],
    []
  )
  const availableDiagnosisIndicators = useMemo(
    () => diagnosisIndicators.filter(indicator => indicator.project_id === projectId),
    [diagnosisIndicators, projectId]
  )

  useEffect(() => {
    if (!diagnosisIndicatorId) return

    const stillAvailable = availableDiagnosisIndicators.some(indicator => indicator.id === diagnosisIndicatorId)
    if (!stillAvailable) {
      setDiagnosisIndicatorId('')
    }
  }, [availableDiagnosisIndicators, diagnosisIndicatorId])

  function validate() {
    const nextErrors: FormErrors = {}

    if (!projectId) nextErrors.project_id = 'Selecione o projeto vinculado.'
    if (!kpiName.trim()) nextErrors.kpi_name = 'Informe o nome do KPI.'
    if (diagnosisFeatureEnabled && originType === 'diagnostic' && !diagnosisIndicatorId) {
      nextErrors.diagnosis_indicator_id = 'Selecione o indicador-base do diagnóstico.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!validate()) return

    setSaving(true)

    const kpiNameValue = kpiName.trim()
    const categoryValue = category.trim() || null
    const descriptionValue = description.trim() || null
    const unitOfMeasureValue = unitOfMeasure.trim() || null
    const targetValueParsed = targetValue === '' ? null : Number(targetValue)
    const currentValueParsed = currentValue === '' ? null : Number(currentValue)
    const responsibleIdValue = responsibleId || null
    const notesValue = notes.trim() || null
    const trendValue = trend || null
    const diagnosisIndicatorValue =
      diagnosisFeatureEnabled && originType === 'diagnostic' ? diagnosisIndicatorId || null : null

    const updatePayload: KpiUpdatePayload = {
      kpi_name: kpiNameValue,
      current_value: currentValueParsed,
      target_value: targetValueParsed,
      status,
      trend: trendValue,
      visible_to_client: visibleToClient,
    }

    if (canEditStructuralFields) {
      updatePayload.reading_type = readingType
    }

    if (canEditUnitOfMeasure) {
      updatePayload.unit_of_measure = unitOfMeasureValue
    }

    if (diagnosisFeatureEnabled && canEditStructuralFields) {
      updatePayload.origin_type = originType
      updatePayload.diagnosis_indicator_id = diagnosisIndicatorValue
    }

    try {
      const kpisTable = supabase.from('kpis') as any

      if (mode === 'create') {
        const { data: authData } = await supabase.auth.getUser()
        const insertPayload: InsertDto<'kpis'> = {
          project_id: projectId,
          kpi_name: kpiNameValue,
          category: categoryValue,
          description: descriptionValue,
          classification,
          unit_of_measure: unitOfMeasureValue,
          target_value: targetValueParsed,
          current_value: currentValueParsed,
      update_frequency: updateFrequency,
      responsible_id: responsibleIdValue,
      reading_type: readingType,
      status,
          trend: trendValue,
          notes: notesValue,
          visible_to_client: visibleToClient,
          created_by: authData.user?.id ?? null,
        }

        if (diagnosisFeatureEnabled) {
          insertPayload.origin_type = originType
          insertPayload.diagnosis_indicator_id = diagnosisIndicatorValue
        }

        const { data, error } = await kpisTable
          .insert(insertPayload)
          .select('id')
          .single()

        if (error || !data) {
          throw new Error(error?.message ?? 'Não foi possível criar o KPI.')
        }

        router.push(`/dashboard/kpis/${(data as { id: string }).id}`)
      } else if (initialData) {
        const { data, error } = await kpisTable
          .update(updatePayload)
          .eq('id', initialData.id)
          .select('id')
          .single()

        if (error || !data) {
          throw new Error(error?.message ?? 'Não foi possível atualizar o KPI.')
        }

        router.push(`/dashboard/kpis/${(data as { id: string }).id}`)
      }

      router.refresh()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o KPI. Tente novamente.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
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
          <label htmlFor="responsible_id" className="label">
            Responsável
          </label>
          <select
            id="responsible_id"
            value={responsibleId}
            onChange={event => setResponsibleId(event.target.value)}
            className="input"
            disabled={saving || mode === 'edit'}
          >
            <option value="">Não definido</option>
            {responsibles.map(option => (
              <option key={option.id} value={option.id}>
                {option.full_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="reading_type" className="label">
            Leitura do KPI
          </label>
          <select
            id="reading_type"
            value={readingType}
            onChange={event => setReadingType(event.target.value as KpiReadingType)}
            className="input"
            disabled={saving || (mode === 'edit' && !canEditStructuralFields)}
          >
            {readingTypeOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="kpi_name" className="label">
            Nome do KPI *
          </label>
          <input
            id="kpi_name"
            value={kpiName}
            onChange={event => setKpiName(event.target.value)}
            className="input"
            placeholder="Ex.: OTIF, Acuracidade de estoque, Nível de serviço"
            disabled={saving}
          />
          {errors.kpi_name && <p className="mt-1 text-xs text-red-600">{errors.kpi_name}</p>}
        </div>

        <div>
          <label htmlFor="category" className="label">
            Categoria
          </label>
          <input
            id="category"
            value={category}
            onChange={event => setCategory(event.target.value)}
            className="input"
            placeholder="Ex.: Operação, Nível de serviço"
            disabled={saving || mode === 'edit'}
          />
        </div>

        <div>
          <label htmlFor="classification" className="label">
            Classificação
          </label>
          <select
            id="classification"
            value={classification}
            onChange={event => setClassification(event.target.value as KpiClassification)}
            className="input"
            disabled={saving || mode === 'edit'}
          >
            {classificationOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {diagnosisFeatureEnabled && (
          <div>
            <label htmlFor="origin_type" className="label">
              Origem do KPI
            </label>
            <select
              id="origin_type"
              value={originType}
              onChange={event => {
                const nextValue = event.target.value as KpiOriginType
                setOriginType(nextValue)
                if (nextValue !== 'diagnostic') {
                  setDiagnosisIndicatorId('')
                }
              }}
              className="input"
              disabled={saving || (mode === 'edit' && !canEditStructuralFields)}
            >
              {originTypeOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="unit_of_measure" className="label">
            Unidade
          </label>
          <input
            id="unit_of_measure"
            value={unitOfMeasure}
            onChange={event => setUnitOfMeasure(event.target.value)}
            className="input"
            placeholder="Ex.: %, dias, pedidos"
            disabled={saving || (mode === 'edit' && !canEditUnitOfMeasure)}
          />
          {mode === 'edit' && !canEditUnitOfMeasure && (
            <p className="mt-1 text-xs text-neutral-500">
              Apenas administradores FAUS podem corrigir a unidade de medida após a criação.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="update_frequency" className="label">
            Frequência
          </label>
          <select
            id="update_frequency"
            value={updateFrequency}
            onChange={event => setUpdateFrequency(event.target.value as KpiFrequency)}
            className="input"
            disabled={saving || mode === 'edit'}
          >
            {frequencyOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {diagnosisFeatureEnabled && originType === 'diagnostic' && (
          <div className="md:col-span-2 rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
            <label htmlFor="diagnosis_indicator_id" className="label">
              Indicador-base do diagnóstico *
            </label>
            <select
              id="diagnosis_indicator_id"
              value={diagnosisIndicatorId}
              onChange={event => setDiagnosisIndicatorId(event.target.value)}
              className="input"
              disabled={saving || (mode === 'edit' && !canEditStructuralFields)}
            >
              <option value="">Selecione</option>
              {availableDiagnosisIndicators.map(indicator => (
                <option key={indicator.id} value={indicator.id}>
                  {indicator.area} • {indicator.indicator_name}
                </option>
              ))}
            </select>
            {errors.diagnosis_indicator_id && (
              <p className="mt-1 text-xs text-red-600">{errors.diagnosis_indicator_id}</p>
            )}
            <p className="mt-2 text-xs text-neutral-500">
              O baseline do indicador selecionado será exibido no detalhe do KPI.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="target_value" className="label">
            Meta
          </label>
          <input
            id="target_value"
            type="number"
            step="any"
            value={targetValue}
            onChange={event => setTargetValue(event.target.value)}
            className="input"
            placeholder="0"
            disabled={saving}
          />
        </div>

        <div>
          <label htmlFor="current_value" className="label">
            Valor atual
          </label>
          <input
            id="current_value"
            type="number"
            step="any"
            value={currentValue}
            onChange={event => setCurrentValue(event.target.value)}
            className="input"
            placeholder="0"
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
            onChange={event => setStatus(event.target.value as KpiStatus)}
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
          <label htmlFor="trend" className="label">
            Tendência
          </label>
          <select
            id="trend"
            value={trend}
            onChange={event => setTrend(event.target.value as KpiTrend | '')}
            className="input"
            disabled={saving}
          >
            <option value="">Não definida</option>
            {trendOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="description" className="label">
            Descrição
          </label>
          <textarea
            id="description"
            value={description}
            onChange={event => setDescription(event.target.value)}
            className="input min-h-24 resize-y"
            placeholder="Contexto do indicador e leitura executiva."
            disabled={saving || mode === 'edit'}
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="notes" className="label">
            Observações
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={event => setNotes(event.target.value)}
            className="input min-h-24 resize-y"
            placeholder="Notas complementares sobre a medição."
            disabled={saving || mode === 'edit'}
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
                Ative apenas quando o indicador puder ser apresentado também ao cliente.
              </span>
            </span>
          </label>
        </div>
      </div>

      {mode === 'edit' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Na edição, este schema atual permite atualizar nome, valor atual, meta, status, tendência e visibilidade. Projeto, frequência, responsável e notas permanecem somente para leitura. A unidade de medida pode ser corrigida apenas por administradores FAUS.
        </div>
      )}

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href={initialData ? `/dashboard/kpis/${initialData.id}` : '/dashboard/kpis'} className="btn-secondary">
          Cancelar
        </Link>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving && <Loader2 size={16} className="animate-spin" />}
          {mode === 'create' ? 'Criar KPI' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}
