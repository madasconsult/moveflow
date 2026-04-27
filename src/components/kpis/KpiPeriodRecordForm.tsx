'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  calculateKpiPerformance,
  formatMeasurementValue,
  formatPercentageValue,
  getTrendFromValues,
  KPI_PERIOD_RECORD_STATUS_LABELS,
  KPI_READING_TYPE_LABELS,
  PERFORMANCE_STATUS_COLORS,
  PERFORMANCE_STATUS_LABELS,
} from '@/lib/utils'
import type {
  InsertDto,
  Kpi,
  KpiPeriodRecord,
  KpiPeriodRecordStatus,
  KpiTargetPeriod,
  UpdateDto,
} from '@/types/database.types'

interface KpiPeriodRecordFormProps {
  mode: 'create' | 'edit'
  kpi: Pick<Kpi, 'id' | 'kpi_name' | 'reading_type' | 'unit_of_measure' | 'current_value'>
  targetPeriod: Pick<
    KpiTargetPeriod,
    'id' | 'period_label' | 'planned_target' | 'green_threshold' | 'yellow_threshold' | 'red_threshold' | 'is_active'
  >
  initialData?: KpiPeriodRecord
}

interface FormErrors {
  actual_value?: string
  justification?: string
  short_analysis?: string
}

export function KpiPeriodRecordForm({
  mode,
  kpi,
  targetPeriod,
  initialData,
}: KpiPeriodRecordFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [actualValue, setActualValue] = useState(initialData?.actual_value?.toString() ?? '')
  const [justification, setJustification] = useState(initialData?.justification ?? '')
  const [shortAnalysis, setShortAnalysis] = useState(initialData?.short_analysis ?? '')
  const [periodStatus, setPeriodStatus] = useState<KpiPeriodRecordStatus>(initialData?.period_status ?? 'aberto')
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const statusOptions = useMemo(
    () => Object.entries(KPI_PERIOD_RECORD_STATUS_LABELS) as [KpiPeriodRecordStatus, string][],
    []
  )

  const canEdit = !initialData || initialData.period_status === 'aberto'
  const actualValueNumber = actualValue === '' ? null : Number(actualValue)
  const calculated = actualValueNumber === null || Number.isNaN(actualValueNumber)
    ? null
    : calculateKpiPerformance({
        readingType: kpi.reading_type,
        plannedTarget: targetPeriod.planned_target,
        greenThreshold: targetPeriod.green_threshold,
        yellowThreshold: targetPeriod.yellow_threshold,
        redThreshold: targetPeriod.red_threshold,
        actualValue: actualValueNumber,
      })

  function validate() {
    const nextErrors: FormErrors = {}

    if (actualValue === '') nextErrors.actual_value = 'Informe o valor realizado.'
    if (calculated?.status === 'yellow' || calculated?.status === 'red') {
      if (!justification.trim()) nextErrors.justification = 'Justificativa obrigatória para amarelo ou vermelho.'
    }
    if (calculated?.status === 'red' && !shortAnalysis.trim()) {
      nextErrors.short_analysis = 'Análise resumida obrigatória quando o farol estiver vermelho.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!canEdit) {
      setFormError('Esta apuração está fechada ou revisada e não pode ser alterada livremente.')
      return
    }

    if (!targetPeriod.is_active) {
      setFormError('Não é possível apurar um período inativo.')
      return
    }

    if (!calculated || !validate()) return

    setSaving(true)

    try {
      const recordsTable = supabase.from('kpi_period_records') as any
      const kpisTable = supabase.from('kpis') as any
      const { data: authData } = await supabase.auth.getUser()

      if (mode === 'create') {
        const insertPayload: InsertDto<'kpi_period_records'> = {
          kpi_id: kpi.id,
          target_period_id: targetPeriod.id,
          competence: targetPeriod.period_label,
          actual_value: Number(actualValue),
          calculated_status: calculated.status,
          absolute_deviation: calculated.absoluteDeviation,
          percentage_deviation: calculated.percentageDeviation,
          justification: justification.trim() || null,
          short_analysis: shortAnalysis.trim() || null,
          recorded_by: authData.user?.id ?? null,
          period_status: periodStatus,
        }

        const { error } = await recordsTable.insert(insertPayload)
        if (error) throw new Error(error.message)
      } else if (initialData) {
        const updatePayload: UpdateDto<'kpi_period_records'> = {
          actual_value: Number(actualValue),
          calculated_status: calculated.status,
          absolute_deviation: calculated.absoluteDeviation,
          percentage_deviation: calculated.percentageDeviation,
          justification: justification.trim() || null,
          short_analysis: shortAnalysis.trim() || null,
          period_status: periodStatus,
        }

        const { error } = await recordsTable
          .update(updatePayload)
          .eq('id', initialData.id)

        if (error) throw new Error(error.message)
      }

      const nextTrend = getTrendFromValues(kpi.current_value, Number(actualValue), kpi.reading_type)
      const mappedStatus =
        calculated.status === 'green'
          ? 'on_target'
          : calculated.status === 'yellow'
            ? 'at_risk'
            : 'below_target'

      await kpisTable
        .update({
          previous_value: kpi.current_value,
          current_value: Number(actualValue),
          target_value: targetPeriod.planned_target,
          status: mappedStatus,
          trend: nextTrend,
          last_update_date: new Date().toISOString(),
        })
        .eq('id', kpi.id)

      router.push(`/dashboard/kpis/${kpi.id}`)
      router.refresh()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a apuração do período.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Apuração do período</h2>
        <p className="mt-1 text-sm text-neutral-500">
          KPI: {kpi.kpi_name} • {targetPeriod.period_label} • {KPI_READING_TYPE_LABELS[kpi.reading_type]}
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <p className="label">Meta do período</p>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
            {formatMeasurementValue(targetPeriod.planned_target, kpi.unit_of_measure)}
          </div>
        </div>

        <div>
          <label htmlFor="actual_value" className="label">Realizado *</label>
          <input
            id="actual_value"
            type="number"
            step="any"
            className="input"
            value={actualValue}
            onChange={event => setActualValue(event.target.value)}
            disabled={saving || !canEdit}
          />
          {errors.actual_value && <p className="mt-1 text-xs text-red-600">{errors.actual_value}</p>}
        </div>

        <div>
          <label htmlFor="period_status" className="label">Governança do período</label>
          <select
            id="period_status"
            className="input"
            value={periodStatus}
            onChange={event => setPeriodStatus(event.target.value as KpiPeriodRecordStatus)}
            disabled={saving || !canEdit}
          >
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Farol automático</p>
          {calculated ? (
            <div className="mt-3 space-y-2">
              <span className={`badge ${PERFORMANCE_STATUS_COLORS[calculated.status]}`}>
                {PERFORMANCE_STATUS_LABELS[calculated.status]}
              </span>
              <p className="text-sm text-neutral-700">
                Desvio: {formatMeasurementValue(calculated.absoluteDeviation, kpi.unit_of_measure)}
              </p>
              <p className="text-sm text-neutral-700">
                Desvio percentual: {formatPercentageValue(calculated.percentageDeviation)}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">
              Informe o realizado para calcular o farol.
            </p>
          )}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="justification" className="label">Justificativa</label>
          <textarea
            id="justification"
            className="input min-h-24"
            value={justification}
            onChange={event => setJustification(event.target.value)}
            disabled={saving || !canEdit}
          />
          {errors.justification && <p className="mt-1 text-xs text-red-600">{errors.justification}</p>}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="short_analysis" className="label">Análise resumida</label>
          <textarea
            id="short_analysis"
            className="input min-h-24"
            value={shortAnalysis}
            onChange={event => setShortAnalysis(event.target.value)}
            disabled={saving || !canEdit}
          />
          {errors.short_analysis && <p className="mt-1 text-xs text-red-600">{errors.short_analysis}</p>}
        </div>
      </div>

      {!canEdit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Esta apuração está com governança {KPI_PERIOD_RECORD_STATUS_LABELS[initialData!.period_status].toLowerCase()} e não pode ser alterada livremente.
        </div>
      )}

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href={`/dashboard/kpis/${kpi.id}`} className="btn-secondary">
          Cancelar
        </Link>
        <button type="submit" className="btn-primary" disabled={saving || !canEdit}>
          {saving && <Loader2 size={16} className="animate-spin" />}
          {mode === 'create' ? 'Registrar apuração' : 'Salvar apuração'}
        </button>
      </div>
    </form>
  )
}
