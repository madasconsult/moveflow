'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getMonthEndDate,
  getMonthIndexFromDate,
  getMonthPeriodLabel,
  getMonthStartDate,
  getYearFromDate,
  KPI_MONTH_OPTIONS,
  KPI_READING_TYPE_LABELS,
  periodsOverlap,
  validateThresholdOrder,
} from '@/lib/utils'
import type {
  InsertDto,
  Kpi,
  KpiTargetPeriod,
  UpdateDto,
} from '@/types/database.types'

interface ExistingPeriod
  extends Pick<
    KpiTargetPeriod,
    | 'id'
    | 'period_label'
    | 'start_date'
    | 'end_date'
    | 'planned_target'
    | 'green_threshold'
    | 'yellow_threshold'
    | 'red_threshold'
    | 'notes'
    | 'is_active'
  > {}

interface KpiTargetPeriodFormProps {
  mode: 'create' | 'edit'
  kpi: Pick<Kpi, 'id' | 'kpi_name' | 'reading_type'>
  existingPeriods: ExistingPeriod[]
  initialData?: KpiTargetPeriod
  defaultYear?: number
}

interface MonthDraft {
  id?: string
  plannedTarget: string
  greenThreshold: string
  yellowThreshold: string
  redThreshold: string
}

type ErrorRowKey = 'plannedTarget' | 'greenThreshold' | 'yellowThreshold' | 'redThreshold'

interface FormErrors {
  year?: string
  table?: string
  rows: Partial<Record<number, Partial<Record<ErrorRowKey, string>>>>
}

const EMPTY_MONTH_DRAFT: MonthDraft = {
  plannedTarget: '',
  greenThreshold: '',
  yellowThreshold: '',
  redThreshold: '',
}

function getInitialYear(initialData?: KpiTargetPeriod, defaultYear?: number) {
  return (
    getYearFromDate(initialData?.start_date) ??
    defaultYear ??
    new Date().getFullYear()
  )
}

function buildDrafts(year: number, existingPeriods: ExistingPeriod[]) {
  const drafts = KPI_MONTH_OPTIONS.map(() => ({ ...EMPTY_MONTH_DRAFT }))

  existingPeriods.forEach(period => {
    if (getYearFromDate(period.start_date) !== year) return
    const monthIndex = getMonthIndexFromDate(period.start_date)
    if (monthIndex === null) return

    drafts[monthIndex] = {
      id: period.id,
      plannedTarget: period.planned_target?.toString() ?? '',
      greenThreshold: period.green_threshold?.toString() ?? '',
      yellowThreshold: period.yellow_threshold?.toString() ?? '',
      redThreshold: period.red_threshold?.toString() ?? '',
    }
  })

  return drafts
}

export function KpiTargetPeriodForm({
  mode,
  kpi,
  existingPeriods,
  initialData,
  defaultYear,
}: KpiTargetPeriodFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const initialYear = useMemo(
    () => getInitialYear(initialData, defaultYear),
    [defaultYear, initialData]
  )

  const [selectedYear, setSelectedYear] = useState(initialYear.toString())
  const [monthDrafts, setMonthDrafts] = useState<MonthDraft[]>(
    buildDrafts(initialYear, existingPeriods)
  )
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true)
  const [errors, setErrors] = useState<FormErrors>({ rows: {} })
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedYearNumber = Number(selectedYear)

  const yearOptions = useMemo(() => {
    const years = new Set<number>()

    existingPeriods.forEach(period => {
      const year = getYearFromDate(period.start_date)
      if (year) years.add(year)
    })

    years.add(initialYear)
    years.add(new Date().getFullYear())

    return Array.from(years).sort((a, b) => a - b)
  }, [existingPeriods, initialYear])

  const periodsOutsideYear = useMemo(
    () =>
      existingPeriods.filter(period => {
        const periodYear = getYearFromDate(period.start_date)
        return periodYear !== selectedYearNumber
      }),
    [existingPeriods, selectedYearNumber]
  )

  useEffect(() => {
    if (!Number.isFinite(selectedYearNumber)) return
    setMonthDrafts(buildDrafts(selectedYearNumber, existingPeriods))
  }, [existingPeriods, selectedYearNumber])

  function updateMonthDraft(
    monthIndex: number,
    field: keyof MonthDraft,
    value: string
  ) {
    setMonthDrafts(current =>
      current.map((draft, index) =>
        index === monthIndex ? { ...draft, [field]: value } : draft
      )
    )
  }

  function replicateRow(field: keyof Omit<MonthDraft, 'id'>) {
    const sourceValue = monthDrafts[0]?.[field] ?? ''
    setMonthDrafts(current =>
      current.map(draft => ({
        ...draft,
        [field]: sourceValue,
      }))
    )
  }

  function validate() {
    const nextErrors: FormErrors = { rows: {} }

    if (!selectedYear || Number.isNaN(selectedYearNumber)) {
      nextErrors.year = 'Informe um ano válido para a grade mensal.'
    }

    let hasAnyConfiguredMonth = false

    KPI_MONTH_OPTIONS.forEach(({ index }) => {
      const draft = monthDrafts[index]
      const filledFields = [
        draft.plannedTarget,
        draft.greenThreshold,
        draft.yellowThreshold,
        draft.redThreshold,
      ].filter(Boolean).length

      if (filledFields === 0) return

      hasAnyConfiguredMonth = true

      if (filledFields < 4) {
        nextErrors.rows[index] = {
          plannedTarget: 'Preencha meta e todas as faixas do mês.',
          greenThreshold: 'Preencha meta e todas as faixas do mês.',
          yellowThreshold: 'Preencha meta e todas as faixas do mês.',
          redThreshold: 'Preencha meta e todas as faixas do mês.',
        }
        return
      }

      const green = Number(draft.greenThreshold)
      const yellow = Number(draft.yellowThreshold)
      const red = Number(draft.redThreshold)

      if (!validateThresholdOrder(kpi.reading_type, green, yellow, red)) {
        nextErrors.rows[index] = {
          greenThreshold: 'Faixas incoerentes para este tipo de leitura.',
          yellowThreshold: 'Revise a ordem das faixas.',
          redThreshold: 'Revise a ordem das faixas.',
        }
      }

      const monthStart = getMonthStartDate(selectedYearNumber, index)
      const monthEnd = getMonthEndDate(selectedYearNumber, index)

      const hasOverlap = periodsOutsideYear.some(period =>
        period.is_active &&
        periodsOverlap(monthStart, monthEnd, period.start_date, period.end_date)
      )

      if (hasOverlap) {
        nextErrors.rows[index] = {
          ...nextErrors.rows[index],
          plannedTarget: 'Já existe um período ativo sobreposto a este mês.',
        }
      }
    })

    if (!hasAnyConfiguredMonth) {
      nextErrors.table = 'Preencha pelo menos um mês completo para salvar a meta.'
    }

    setErrors(nextErrors)
    return !nextErrors.year && !nextErrors.table && Object.keys(nextErrors.rows).length === 0
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!validate()) return

    setSaving(true)

    try {
      const periodsTable = supabase.from('kpi_target_periods') as any
      const kpisTable = supabase.from('kpis') as any

      const operations: Promise<any>[] = []

      KPI_MONTH_OPTIONS.forEach(({ index }) => {
        const draft = monthDrafts[index]
        const isConfigured =
          draft.plannedTarget !== '' &&
          draft.greenThreshold !== '' &&
          draft.yellowThreshold !== '' &&
          draft.redThreshold !== ''

        if (!isConfigured) {
          if (draft.id) {
            operations.push(
              periodsTable
                .update({
                  is_active: false,
                  notes: notes.trim() || null,
                } satisfies UpdateDto<'kpi_target_periods'>)
                .eq('id', draft.id)
            )
          }
          return
        }

        const payload = {
          period_label: getMonthPeriodLabel(selectedYearNumber, index),
          start_date: getMonthStartDate(selectedYearNumber, index),
          end_date: getMonthEndDate(selectedYearNumber, index),
          planned_target: Number(draft.plannedTarget),
          green_threshold: Number(draft.greenThreshold),
          yellow_threshold: Number(draft.yellowThreshold),
          red_threshold: Number(draft.redThreshold),
          notes: notes.trim() || null,
          is_active: isActive,
        }

        if (draft.id) {
          operations.push(
            periodsTable
              .update(payload satisfies UpdateDto<'kpi_target_periods'>)
              .eq('id', draft.id)
          )
        } else {
          operations.push(
            periodsTable.insert({
              kpi_id: kpi.id,
              ...payload,
            } satisfies InsertDto<'kpi_target_periods'>)
          )
        }
      })

      const results = await Promise.all(operations)
      const failedResult = results.find(result => result?.error)

      if (failedResult?.error) {
        throw new Error(failedResult.error.message)
      }

      const today = new Date()
      const currentYear = today.getFullYear()
      const currentMonth = today.getMonth()
      const currentMonthDraft = monthDrafts[currentMonth]

      if (
        isActive &&
        currentYear === selectedYearNumber &&
        currentMonthDraft &&
        currentMonthDraft.plannedTarget !== ''
      ) {
        await kpisTable
          .update({ target_value: Number(currentMonthDraft.plannedTarget) })
          .eq('id', kpi.id)
      }

      router.push(`/dashboard/kpis/${kpi.id}?year=${selectedYearNumber}#performance`)
      router.refresh()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a grade mensal de metas.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Planejamento mensal da meta</h2>
          <p className="mt-1 text-sm text-neutral-500">
            KPI: {kpi.kpi_name} • {KPI_READING_TYPE_LABELS[kpi.reading_type]}
          </p>
        </div>

        <div className="w-full lg:max-w-[180px]">
          <label htmlFor="performance_year" className="label">Ano da grade</label>
          <select
            id="performance_year"
            className="input"
            value={selectedYear}
            onChange={event => setSelectedYear(event.target.value)}
            disabled={saving}
          >
            {yearOptions.map(year => (
              <option key={year} value={year.toString()}>
                {year}
              </option>
            ))}
            {!yearOptions.includes(selectedYearNumber) && selectedYear && (
              <option value={selectedYear}>{selectedYear}</option>
            )}
          </select>
          {errors.year && <p className="mt-1 text-xs text-red-600">{errors.year}</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => replicateRow('plannedTarget')} disabled={saving}>
            Replicar meta de jan
          </button>
          <button type="button" className="btn-secondary" onClick={() => replicateRow('greenThreshold')} disabled={saving}>
            Replicar verde de jan
          </button>
          <button type="button" className="btn-secondary" onClick={() => replicateRow('yellowThreshold')} disabled={saving}>
            Replicar amarelo de jan
          </button>
          <button type="button" className="btn-secondary" onClick={() => replicateRow('redThreshold')} disabled={saving}>
            Replicar vermelho de jan
          </button>
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Para uma meta única no ano, preencha janeiro e replique. Para metas escalonadas, ajuste mês a mês.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Os valores desta grade seguem a unidade de medida configurada no KPI.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200">
        <table className="min-w-[1180px] w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-3">Faixa</th>
              {KPI_MONTH_OPTIONS.map(month => (
                <th key={month.label} className="px-3 py-3 text-center">
                  {getMonthPeriodLabel(selectedYearNumber, month.index)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {[
              ['plannedTarget', 'Meta'] as const,
              ['greenThreshold', 'Faixa verde'] as const,
              ['yellowThreshold', 'Faixa amarela'] as const,
              ['redThreshold', 'Faixa vermelha'] as const,
            ].map(([field, label]) => (
              <tr key={field}>
                <td className="px-4 py-3 font-medium text-neutral-800">{label}</td>
                {KPI_MONTH_OPTIONS.map(month => (
                  <td key={`${field}-${month.index}`} className="px-2 py-3 align-top">
                    <input
                      type="number"
                      step="any"
                      className="input text-center"
                      value={monthDrafts[month.index]?.[field] ?? ''}
                      onChange={event => updateMonthDraft(month.index, field, event.target.value)}
                      disabled={saving}
                    />
                    {errors.rows[month.index]?.[field] && (
                      <p className="mt-1 text-[11px] leading-4 text-red-600">
                        {errors.rows[month.index]?.[field]}
                      </p>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <label htmlFor="period_notes" className="label">Observações da grade anual</label>
          <textarea
            id="period_notes"
            className="input min-h-24"
            value={notes}
            onChange={event => setNotes(event.target.value)}
            disabled={saving}
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-neutral-700 md:pt-9">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
            checked={isActive}
            onChange={event => setIsActive(event.target.checked)}
            disabled={saving}
          />
          Grade ativa
        </label>
      </div>

      {errors.table && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.table}
        </div>
      )}

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href={`/dashboard/kpis/${kpi.id}?year=${selectedYearNumber}#performance`} className="btn-secondary">
          Cancelar
        </Link>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving && <Loader2 size={16} className="animate-spin" />}
          {mode === 'create' ? 'Salvar grade de metas' : 'Atualizar grade de metas'}
        </button>
      </div>
    </form>
  )
}
