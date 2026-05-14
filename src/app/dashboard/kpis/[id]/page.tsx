import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { BarChart3, CalendarRange, Pencil, TrendingUp, UserCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import {
  KPI_ORIGIN_TYPE_LABELS,
  KPI_CLASSIFICATION_LABELS,
  FSP_STATUS_COLORS,
  FSP_STATUS_LABELS,
  KPI_FREQUENCY_LABELS,
  KPI_PERIOD_RECORD_STATUS_COLORS,
  KPI_PERIOD_RECORD_STATUS_LABELS,
  KPI_MONTH_OPTIONS,
  KPI_READING_TYPE_LABELS,
  KPI_STATUS_COLORS,
  KPI_STATUS_LABELS,
  KPI_TREND_COLORS,
  KPI_TREND_LABELS,
  PERFORMANCE_STATUS_COLORS,
  PERFORMANCE_STATUS_LABELS,
  cn,
  formatDate,
  formatMeasurementValue,
  formatPercentageValue,
  getMonthIndexFromDate,
  getMonthPeriodLabel,
  getYearFromDate,
} from '@/lib/utils'
import { KpiPerformanceChart } from '@/components/kpis/KpiPerformanceChart'
import type {
  DiagnosisIndicator,
  Fsp,
  Kpi,
  KpiPeriodRecord,
  KpiTargetPeriod,
  Profile,
  Project,
} from '@/types/database.types'

export const metadata: Metadata = { title: 'Detalhe do KPI' }

interface PageProps {
  params: { id: string }
  searchParams?: { year?: string }
}

type ProjectLookup = Pick<Project, 'id' | 'project_name' | 'main_consultant_id'>
type ResponsibleLookup = Pick<Profile, 'id' | 'full_name' | 'email'>
type DiagnosisIndicatorLookup = Pick<
  DiagnosisIndicator,
  'id' | 'area' | 'indicator_name' | 'baseline_value' | 'reference_date' | 'unit_of_measure'
>
type TargetLookup = Pick<
  KpiTargetPeriod,
  | 'id'
  | 'kpi_id'
  | 'period_label'
  | 'start_date'
  | 'end_date'
  | 'planned_target'
  | 'green_threshold'
  | 'yellow_threshold'
  | 'red_threshold'
  | 'notes'
  | 'is_active'
>
type RecordLookup = Pick<
  KpiPeriodRecord,
  | 'id'
  | 'kpi_id'
  | 'target_period_id'
  | 'competence'
  | 'actual_value'
  | 'calculated_status'
  | 'absolute_deviation'
  | 'percentage_deviation'
  | 'justification'
  | 'short_analysis'
  | 'recorded_at'
  | 'period_status'
>
type FspLookup = Pick<Fsp, 'id' | 'title' | 'status' | 'kpi_period_record_id' | 'linked_action_id' | 'generated_action_id'>

function getCurrentTargetPeriod(periods: TargetLookup[]) {
  const today = new Date().toISOString().slice(0, 10)
  return (
    periods.find(period => period.is_active && period.start_date <= today && period.end_date >= today) ??
    periods.find(period => period.is_active) ??
    periods[0] ??
    null
  )
}

export default async function KpiDetailPage({ params, searchParams }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const supabase = await createClient()
  const { data } = await supabase
    .from('kpis')
    .select('*')
    .eq('id', params.id)
    .single()

  const kpi = (data as Kpi | null) ?? null
  if (!kpi) notFound()

  const [projectRes, responsibleRes, diagnosisIndicatorRes, targetPeriodsRes, recordRes, fspRes] = await Promise.all([
    supabase.from('projects').select('id, project_name, main_consultant_id').eq('id', kpi.project_id).single(),
    kpi.responsible_id
      ? supabase.from('profiles').select('id, full_name, email').eq('id', kpi.responsible_id).single()
      : Promise.resolve({ data: null }),
    kpi.diagnosis_indicator_id
      ? supabase
          .from('diagnosis_indicators')
          .select('id, area, indicator_name, baseline_value, reference_date, unit_of_measure')
          .eq('id', kpi.diagnosis_indicator_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from('kpi_target_periods')
      .select('id, kpi_id, period_label, start_date, end_date, planned_target, green_threshold, yellow_threshold, red_threshold, notes, is_active')
      .eq('kpi_id', kpi.id)
      .order('start_date', { ascending: false }),
    supabase
      .from('kpi_period_records')
      .select('id, kpi_id, target_period_id, competence, actual_value, calculated_status, absolute_deviation, percentage_deviation, justification, short_analysis, recorded_at, period_status')
      .eq('kpi_id', kpi.id)
      .order('recorded_at', { ascending: false }),
    supabase
      .from('fsps')
      .select('id, title, status, kpi_period_record_id, linked_action_id, generated_action_id')
      .eq('kpi_id', kpi.id)
      .order('opened_at', { ascending: false }),
  ])

  const project = (projectRes.data as ProjectLookup | null) ?? null
  const responsible = (responsibleRes.data as ResponsibleLookup | null) ?? null
  const diagnosisIndicator = (diagnosisIndicatorRes.data as DiagnosisIndicatorLookup | null) ?? null
  const targetPeriods = (targetPeriodsRes.data as TargetLookup[] | null) ?? []
  const records = (recordRes.data as RecordLookup[] | null) ?? []
  const relatedFsps = (fspRes.data as FspLookup[] | null) ?? []
  const fspByRecord = new Map(
    relatedFsps
      .filter(item => item.kpi_period_record_id)
      .map(item => [item.kpi_period_record_id as string, item])
  )

  const recordByPeriod = new Map(records.map(record => [record.target_period_id, record]))
  const currentPeriod = getCurrentTargetPeriod(targetPeriods)
  const currentRecord = currentPeriod ? recordByPeriod.get(currentPeriod.id) ?? null : null
  const availableYears = Array.from(
    new Set(
      targetPeriods
        .map(period => getYearFromDate(period.start_date))
        .filter((year): year is number => year !== null)
    )
  ).sort((a, b) => a - b)
  const selectedYear =
    (searchParams?.year ? Number(searchParams.year) : null) ||
    getYearFromDate(currentPeriod?.start_date) ||
    availableYears[availableYears.length - 1] ||
    new Date().getFullYear()

  const yearPeriods = targetPeriods.filter(period => getYearFromDate(period.start_date) === selectedYear)
  const monthPeriodMap = new Map(
    yearPeriods.map(period => [getMonthIndexFromDate(period.start_date), period] as const)
  )
  const performanceRows = KPI_MONTH_OPTIONS.map(month => {
    const period = monthPeriodMap.get(month.index) ?? null
    const record = period ? recordByPeriod.get(period.id) ?? null : null
    return {
      month,
      period,
      record,
    }
  })
  const firstEditablePeriod = yearPeriods[0] ?? null
  const chartPoints = KPI_MONTH_OPTIONS.map(month => ({
    label: getMonthPeriodLabel(selectedYear, month.index),
    target: monthPeriodMap.get(month.index)?.planned_target ?? null,
    actual: monthPeriodMap.get(month.index)
      ? recordByPeriod.get((monthPeriodMap.get(month.index) as TargetLookup).id)?.actual_value ?? null
      : null,
  }))
  const diagnosisValue = diagnosisIndicator?.baseline_value ?? null
  const diagnosisUnit = diagnosisIndicator?.unit_of_measure ?? kpi.unit_of_measure
  const performanceUnit = kpi.unit_of_measure ?? diagnosisUnit
  const diagnosisReference = formatMeasurementValue(diagnosisValue, diagnosisUnit)
  const previousValueFormatted = formatMeasurementValue(kpi.previous_value, kpi.unit_of_measure)
  const editYearHref = firstEditablePeriod
    ? `/dashboard/kpis/metas/${firstEditablePeriod.id}/editar?year=${selectedYear}`
    : `/dashboard/kpis/${kpi.id}/periodos/novo?year=${selectedYear}`
  const isAdmin = session.profile.role === 'admin_faus'
  const canManageKpi =
    isAdmin ||
    (session.profile.role === 'consultor_faus' && project?.main_consultant_id === session.profile.id)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">{kpi.kpi_name}</h1>
            <span className={cn('badge', KPI_STATUS_COLORS[kpi.status])}>
              {KPI_STATUS_LABELS[kpi.status]}
            </span>
          </div>
          <p className="page-subtitle">
            Leitura executiva do KPI com baseline, metas por período, apuração, farol e histórico.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/kpis" className="btn-secondary">
            Voltar
          </Link>
          <Link href={`/dashboard/projetos/${kpi.project_id}/kpis`} className="btn-secondary">
            <BarChart3 size={16} />
            Dashboard do projeto
          </Link>
          {canManageKpi && (
            <Link href={`/dashboard/kpis/${kpi.id}/editar`} className="btn-primary">
              <Pencil size={16} />
              Editar KPI
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Parâmetros do KPI</h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-neutral-400">Projeto</p>
                <p className="text-sm text-neutral-800">{project?.project_name ?? 'Projeto vinculado'}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Unidade</p>
                <p className="text-sm text-neutral-800">{kpi.unit_of_measure ?? '—'}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Classificação</p>
                <p className="text-sm text-neutral-800">{KPI_CLASSIFICATION_LABELS[kpi.classification]}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Frequência</p>
                <p className="text-sm text-neutral-800">{KPI_FREQUENCY_LABELS[kpi.update_frequency]}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Origem</p>
                <p className="text-sm text-neutral-800">{KPI_ORIGIN_TYPE_LABELS[kpi.origin_type]}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Leitura</p>
                <p className="text-sm text-neutral-800">{KPI_READING_TYPE_LABELS[kpi.reading_type]}</p>
              </div>
              <div className="md:col-span-2">
                <p className="mb-1 text-xs text-neutral-400">Descrição</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                  {kpi.description ?? 'Nenhuma descrição registrada.'}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="mb-1 text-xs text-neutral-400">Observações</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                  {kpi.notes ?? 'Nenhuma observação registrada.'}
                </p>
              </div>
            </div>
          </div>

          {kpi.origin_type === 'diagnostic' && diagnosisIndicator && (
            <div className="card p-6 space-y-4">
              <h2 className="text-sm font-semibold text-neutral-900">Baseline do diagnóstico</h2>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-neutral-400">Área</p>
                  <p className="text-sm text-neutral-800">{diagnosisIndicator.area}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs text-neutral-400">Data de referência</p>
                  <p className="text-sm text-neutral-800">{formatDate(diagnosisIndicator.reference_date)}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs text-neutral-400">Indicador-base</p>
                  <p className="text-sm text-neutral-800">{diagnosisIndicator.indicator_name}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs text-neutral-400">Baseline</p>
                  <p className="text-sm font-medium text-neutral-900">
                    {formatMeasurementValue(diagnosisIndicator.baseline_value, diagnosisIndicator.unit_of_measure)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <section id="performance" className="card p-6 space-y-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-neutral-400" />
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900">Performance do KPI</h2>
                  <p className="text-sm text-neutral-500">
                    Meta e realizado em leitura mensal, com valor de referência do diagnóstico e farol discreto.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {availableYears.length > 0 &&
                  availableYears.map(year => (
                    <Link
                      key={year}
                      href={`/dashboard/kpis/${kpi.id}?year=${year}#performance`}
                      className={cn(
                        'btn-ghost',
                        selectedYear === year && 'bg-neutral-900 text-white hover:bg-neutral-800'
                      )}
                    >
                      {year}
                    </Link>
                  ))}
                {isAdmin && (
                  <Link href={editYearHref} className="btn-secondary">
                    <CalendarRange size={16} />
                    {firstEditablePeriod ? 'Editar metas do ano' : 'Planejar metas do ano'}
                  </Link>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-[24px] border border-neutral-200">
              <table className="min-w-[1200px] w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Série</th>
                    <th className="px-4 py-3">Valor referência</th>
                    {KPI_MONTH_OPTIONS.map(month => (
                      <th key={month.label} className="px-3 py-3 text-center">
                        {getMonthPeriodLabel(selectedYear, month.index)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white">
                  <tr>
                    <td className="px-4 py-4 font-semibold text-neutral-900">Diagnóstico</td>
                    <td className="px-4 py-4 text-sm font-medium text-neutral-800">
                      {diagnosisIndicator ? diagnosisReference : 'Sem vínculo com diagnóstico'}
                    </td>
                    {KPI_MONTH_OPTIONS.map(month => (
                      <td key={`diagnosis-${month.index}`} className="px-3 py-4 text-center text-neutral-300">
                        —
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="px-4 py-4 font-semibold text-neutral-900">Meta</td>
                    <td className="px-4 py-4 text-neutral-300">—</td>
                    {performanceRows.map(({ month, period }) => (
                      <td key={`target-${month.index}`} className="px-3 py-4 text-center">
                        {period ? (
                          <div className="space-y-1">
                            <p className="font-medium text-neutral-900">
                              {formatMeasurementValue(period.planned_target, performanceUnit)}
                            </p>
                            <p className="text-[11px] text-neutral-400">
                              V {formatMeasurementValue(period.green_threshold, performanceUnit)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="px-4 py-4 font-semibold text-neutral-900">Realizado</td>
                    <td className="px-4 py-4 text-neutral-300">—</td>
                    {performanceRows.map(({ month, period, record }) => (
                      <td key={`actual-${month.index}`} className="px-2 py-3 text-center">
                        {period ? (
                          <div
                            className={cn(
                              'rounded-2xl border px-3 py-3',
                              record
                                ? {
                                    green: 'border-green-200 bg-green-50/70',
                                    yellow: 'border-amber-200 bg-amber-50/80',
                                    red: 'border-red-200 bg-red-50/75',
                                  }[record.calculated_status]
                                : 'border-neutral-200 bg-neutral-50'
                            )}
                          >
                            <p className="font-medium text-neutral-900">
                              {record
                                ? formatMeasurementValue(record.actual_value, performanceUnit)
                                : '—'}
                            </p>
                            {record ? (
                              <div className="mt-1 space-y-1">
                                <p className="text-[11px] text-neutral-500">
                                  {PERFORMANCE_STATUS_LABELS[record.calculated_status]}
                                </p>
                                {canManageKpi && (
                                  <Link
                                    href={`/dashboard/fsps/novo?sourceType=kpi_period&recordId=${record.id}`}
                                    className="inline-block text-[11px] font-medium text-brand-700 hover:text-brand-800"
                                  >
                                    Abrir FSP
                                  </Link>
                                )}
                              </div>
                            ) : canManageKpi ? (
                              <Link
                                href={`/dashboard/kpis/periodos/${period.id}/apuracao`}
                                className="mt-1 inline-block text-[11px] font-medium text-brand-700 hover:text-brand-800"
                              >
                                Apurar
                              </Link>
                            ) : (
                              <p className="mt-1 text-[11px] text-neutral-400">Sem apuração</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <KpiPerformanceChart
              diagnosisValue={diagnosisValue}
              diagnosisLabel="Diagnóstico"
              diagnosisUnit={diagnosisUnit}
              points={chartPoints}
              unit={performanceUnit}
            />
          </section>
        </div>

        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900">Status atual</h2>
            <div className="grid gap-4">
              <div>
                <p className="text-xs text-neutral-400 mb-1">Meta atual</p>
                <p className="text-sm text-neutral-800">
                  {currentPeriod
                    ? formatMeasurementValue(currentPeriod.planned_target, kpi.unit_of_measure)
                    : 'Sem meta vigente'}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 mb-1">Realizado atual</p>
                <p className="text-sm text-neutral-800">
                  {currentRecord
                    ? formatMeasurementValue(currentRecord.actual_value, kpi.unit_of_measure)
                    : 'Sem apuração vigente'}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 mb-1">Valor anterior</p>
                <p className="text-sm text-neutral-800">{previousValueFormatted}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 mb-1">Farol</p>
                {currentRecord ? (
                  <span className={`badge ${PERFORMANCE_STATUS_COLORS[currentRecord.calculated_status]}`}>
                    {PERFORMANCE_STATUS_LABELS[currentRecord.calculated_status]}
                  </span>
                ) : (
                  <span className="text-sm text-neutral-400">Sem apuração</span>
                )}
              </div>
              <div>
                <p className="text-xs text-neutral-400 mb-1">Tendência</p>
                {kpi.trend ? (
                  <span className={`badge ${KPI_TREND_COLORS[kpi.trend]}`}>
                    {KPI_TREND_LABELS[kpi.trend]}
                  </span>
                ) : (
                  <span className="text-sm text-neutral-400">Sem tendência</span>
                )}
              </div>
              <div>
                <p className="text-xs text-neutral-400 mb-1">Visibilidade ao cliente</p>
                <span className={`badge ${kpi.visible_to_client ? 'bg-blue-50 text-blue-700' : 'bg-neutral-100 text-neutral-500'}`}>
                  {kpi.visible_to_client ? 'Visível ao cliente' : 'Interno'}
                </span>
              </div>
              {currentRecord && (
                <>
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">Desvio percentual atual</p>
                    <p className="text-sm text-neutral-700">
                      {formatPercentageValue(currentRecord.percentage_deviation)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">Justificativa atual</p>
                    <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                      {currentRecord.justification ?? 'Sem justificativa registrada.'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">Análise resumida</p>
                    <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                      {currentRecord.short_analysis ?? 'Sem análise resumida registrada.'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <UserCircle2 size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Responsável</h2>
            </div>
            {responsible ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-900">{responsible.full_name}</p>
                <p className="text-sm text-neutral-500">{responsible.email}</p>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Nenhum responsável definido.</p>
            )}
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900">Histórico de apurações</h2>
            <div className="space-y-3">
              {records.length === 0 ? (
                <p className="text-sm text-neutral-500">Nenhuma apuração registrada até o momento.</p>
              ) : (
                records.map(record => (
                  <div key={record.id} className="rounded-2xl border border-neutral-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{record.competence}</p>
                        <p className="text-xs text-neutral-400">Registrado em {formatDate(record.recorded_at)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`badge ${PERFORMANCE_STATUS_COLORS[record.calculated_status]}`}>
                          {PERFORMANCE_STATUS_LABELS[record.calculated_status]}
                        </span>
                        <span className={`badge ${KPI_PERIOD_RECORD_STATUS_COLORS[record.period_status]}`}>
                          {KPI_PERIOD_RECORD_STATUS_LABELS[record.period_status]}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <p className="text-sm text-neutral-700">
                        Realizado: {formatMeasurementValue(record.actual_value, kpi.unit_of_measure)}
                      </p>
                      <p className="text-sm text-neutral-700">
                        Desvio: {formatMeasurementValue(record.absolute_deviation, kpi.unit_of_measure)}
                      </p>
                      <p className="text-sm text-neutral-700">
                        Desvio percentual: {formatPercentageValue(record.percentage_deviation)}
                      </p>
                      <p className="text-sm text-neutral-700 md:col-span-2">
                        Justificativa: {record.justification ?? 'Sem justificativa.'}
                      </p>
                      <div className="md:col-span-2 flex items-center gap-2">
                        {fspByRecord.get(record.id) ? (
                          <>
                            <Link href={`/dashboard/fsps/${fspByRecord.get(record.id)?.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-800">
                              {fspByRecord.get(record.id)?.title}
                            </Link>
                            <span className={`badge ${FSP_STATUS_COLORS[fspByRecord.get(record.id)!.status]}`}>
                              {FSP_STATUS_LABELS[fspByRecord.get(record.id)!.status]}
                            </span>
                          </>
                        ) : canManageKpi ? (
                          <Link href={`/dashboard/fsps/novo?sourceType=kpi_period&recordId=${record.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-800">
                            Abrir FSP para esta apuração
                          </Link>
                        ) : (
                          <span className="text-sm text-neutral-400">Sem FSP relacionada</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-neutral-900">FSPs relacionadas</h2>
              <span className="text-xs text-neutral-400">{relatedFsps.length} registradas</span>
            </div>
            {relatedFsps.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhuma FSP relacionada a este KPI até o momento.</p>
            ) : (
              <div className="space-y-3">
                {relatedFsps.map(fsp => (
                  <div key={fsp.id} className="rounded-2xl border border-neutral-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Link href={`/dashboard/fsps/${fsp.id}`} className="text-sm font-medium text-neutral-900 hover:text-brand-700">
                        {fsp.title}
                      </Link>
                      <span className={`badge ${FSP_STATUS_COLORS[fsp.status]}`}>
                        {FSP_STATUS_LABELS[fsp.status]}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-500">
                      <span>{fsp.kpi_period_record_id ? 'Ligada a um período apurado' : 'Sem período específico'}</span>
                      <span>{fsp.generated_action_id || fsp.linked_action_id ? 'Com ação associada' : 'Sem ação associada'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
