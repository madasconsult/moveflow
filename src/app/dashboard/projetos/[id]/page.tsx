import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, BarChart3, Building2, CheckSquare, ClipboardList, Clock3, Pencil, UserCircle2 } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import {
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_COLORS,
  ACTION_STATUS_LABELS,
  DIAGNOSIS_STATUS_COLORS,
  DIAGNOSIS_STATUS_LABELS,
  KPI_MONTH_OPTIONS,
  KPI_ORIGIN_TYPE_LABELS,
  KPI_STATUS_COLORS,
  KPI_STATUS_LABELS,
  PERFORMANCE_STATUS_COLORS,
  PERFORMANCE_STATUS_LABELS,
  PROJECT_PHASE_LABELS,
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  STRATEGIC_FOCUS_LABELS,
  getMonthIndexFromDate,
  getMonthPeriodLabel,
  getYearFromDate,
  cn,
  formatDate,
  formatMeasurementValue,
} from '@/lib/utils'
import {
  calculateRateAxisScores,
  formatRateScore,
  getRateProfileTemplate,
} from '@/lib/rate-faus'
import type {
  Action,
  Client,
  DiagnosisIndicator,
  Fsp,
  Kpi,
  KpiPeriodRecord,
  KpiTargetPeriod,
  Profile,
  Project,
  ProjectDiagnosis,
  RateAssessment,
  RateAssessmentItem,
  RateAssessmentVersion,
} from '@/types/database.types'

export const metadata: Metadata = { title: 'Detalhe do Projeto' }

interface PageProps {
  params: { id: string }
  searchParams?: { year?: string }
}

type ClientLookup = Pick<Client, 'id' | 'company_name'>
type ConsultantLookup = Pick<Profile, 'id' | 'full_name' | 'email'>
type DiagnosisOwnerLookup = Pick<Profile, 'id' | 'full_name'>
type ActionLookup = Pick<Action, 'id' | 'status'>
type KpiLookup = Pick<
  Kpi,
  | 'id'
  | 'kpi_name'
  | 'origin_type'
  | 'diagnosis_indicator_id'
  | 'reading_type'
  | 'unit_of_measure'
  | 'status'
  | 'visible_to_client'
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
  | 'is_active'
>
type RecordLookup = Pick<KpiPeriodRecord, 'id' | 'target_period_id' | 'actual_value' | 'calculated_status'>
type FspLookup = Pick<Fsp, 'id' | 'kpi_period_record_id'>

function getCurrentTargetPeriod(periods: TargetLookup[]) {
  const today = new Date().toISOString().slice(0, 10)
  return (
    periods.find(period => period.is_active && period.start_date <= today && period.end_date >= today) ??
    periods.find(period => period.is_active) ??
    periods[0] ??
    null
  )
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const supabase = await createClient()

  const { data: projectData } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single()

  const project = (projectData as Project | null) ?? null

  if (!project) notFound()

  const [clientRes, consultantRes, diagnosisRes, actionsRes, kpisRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, company_name')
      .eq('id', project.client_id)
      .single(),
    project.main_consultant_id
      ? supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', project.main_consultant_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from('project_diagnoses')
      .select('*')
      .eq('project_id', project.id)
      .maybeSingle(),
    supabase
      .from('actions')
      .select('id, status')
      .eq('project_id', project.id),
    supabase
      .from('kpis')
      .select('id, kpi_name, origin_type, diagnosis_indicator_id, reading_type, unit_of_measure, status, visible_to_client')
      .eq('project_id', project.id)
      .order('kpi_name'),
  ])

  const client = (clientRes.data as ClientLookup | null) ?? null
  const consultant = (consultantRes.data as ConsultantLookup | null) ?? null
  const diagnosis = (diagnosisRes.data as ProjectDiagnosis | null) ?? null
  const projectActions = (actionsRes.data as ActionLookup[] | null) ?? []
  const kpis = (kpisRes.data as KpiLookup[] | null) ?? []

  const [diagnosisIndicatorsRes, diagnosisOwnerRes, periodsRes, recordsRes, rateAssessmentRes] = await Promise.all([
    diagnosis
      ? supabase
          .from('diagnosis_indicators')
          .select('*')
          .eq('diagnosis_id', diagnosis.id)
          .order('priority', { ascending: false })
      : Promise.resolve({ data: [] as DiagnosisIndicator[] | null }),
    diagnosis?.owner_id
      ? supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', diagnosis.owner_id)
          .single()
      : Promise.resolve({ data: null }),
    kpis.length > 0
      ? supabase
          .from('kpi_target_periods')
          .select('id, kpi_id, period_label, start_date, end_date, planned_target, green_threshold, yellow_threshold, red_threshold, is_active')
          .in('kpi_id', kpis.map(kpi => kpi.id))
          .order('start_date', { ascending: true })
      : Promise.resolve({ data: [] as TargetLookup[] | null }),
    kpis.length > 0
      ? supabase
          .from('kpi_period_records')
          .select('id, target_period_id, actual_value, calculated_status')
          .in('kpi_id', kpis.map(kpi => kpi.id))
          .order('recorded_at', { ascending: false })
      : Promise.resolve({ data: [] as RecordLookup[] | null }),
    diagnosis
      ? supabase
          .from('rate_assessments')
          .select('*')
          .eq('diagnosis_id', diagnosis.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const diagnosisIndicators = (diagnosisIndicatorsRes.data as DiagnosisIndicator[] | null) ?? []
  const diagnosisOwner = (diagnosisOwnerRes.data as DiagnosisOwnerLookup | null) ?? null
  const periods = (periodsRes.data as TargetLookup[] | null) ?? []
  const records = (recordsRes.data as RecordLookup[] | null) ?? []
  const rateAssessment = (rateAssessmentRes.data as RateAssessment | null) ?? null

  const recordIds = records.map(record => record.id)
  const fspRecordsRes =
    recordIds.length > 0
      ? await supabase
          .from('fsps')
          .select('id, kpi_period_record_id')
          .in('kpi_period_record_id', recordIds)
      : { data: [] as FspLookup[] | null }
  const fspRecords = (fspRecordsRes.data as FspLookup[] | null) ?? []

  const periodsByKpi = new Map<string, TargetLookup[]>()
  periods.forEach(period => {
    periodsByKpi.set(period.kpi_id, [...(periodsByKpi.get(period.kpi_id) ?? []), period])
  })
  const recordByPeriod = new Map(records.map(record => [record.target_period_id, record]))
  const fspByRecord = new Map(
    fspRecords
      .filter(item => item.kpi_period_record_id)
      .map(item => [item.kpi_period_record_id as string, item])
  )
  const diagnosisIndicatorMap = new Map(diagnosisIndicators.map(item => [item.id, item]))

  const availableYears = Array.from(
    new Set(periods.map(period => getYearFromDate(period.start_date)).filter((year): year is number => year !== null))
  ).sort((a, b) => a - b)

  const currentYear = new Date().getUTCFullYear()
  const selectedYear = (() => {
    const candidate = Number(searchParams?.year)
    if (Number.isFinite(candidate) && availableYears.includes(candidate)) return candidate
    if (availableYears.includes(currentYear)) return currentYear
    return availableYears[availableYears.length - 1] ?? currentYear
  })()

  const kpiRows = kpis.map(kpi => {
    const currentPeriod = getCurrentTargetPeriod(periodsByKpi.get(kpi.id) ?? [])
    const currentRecord = currentPeriod ? recordByPeriod.get(currentPeriod.id) ?? null : null
    const diagnosisIndicator = kpi.diagnosis_indicator_id
      ? diagnosisIndicatorMap.get(kpi.diagnosis_indicator_id) ?? null
      : null

    const periodsForYear = (periodsByKpi.get(kpi.id) ?? []).filter(period => getYearFromDate(period.start_date) === selectedYear)
    const monthRows = KPI_MONTH_OPTIONS.map(month => {
      const period = periodsForYear.find(item => getMonthIndexFromDate(item.start_date) === month.index) ?? null
      const record = period ? recordByPeriod.get(period.id) ?? null : null
      const linkedFsp = record ? fspByRecord.get(record.id) ?? null : null

      return {
        month,
        period,
        record,
        linkedFsp,
      }
    })

    return {
      ...kpi,
      currentPeriod,
      currentRecord,
      diagnosisIndicator,
      monthRows,
    }
  })

  const rateVersionsRes =
    rateAssessment
      ? await supabase
          .from('rate_assessment_versions')
          .select('*')
          .eq('assessment_id', rateAssessment.id)
          .order('version_number', { ascending: true })
      : { data: [] as RateAssessmentVersion[] | null }

  const rateVersions = (rateVersionsRes.data as RateAssessmentVersion[] | null) ?? []
  const rateItemsRes =
    rateVersions.length > 0
      ? await supabase
          .from('rate_assessment_items')
          .select('*')
          .in('version_id', rateVersions.map(version => version.id))
      : { data: [] as RateAssessmentItem[] | null }
  const rateItems = (rateItemsRes.data as RateAssessmentItem[] | null) ?? []

  const actionSummary = {
    pending: projectActions.filter(action =>
      ['not_started', 'in_progress', 'waiting_faus'].includes(action.status)
    ).length,
    overdue: projectActions.filter(action => action.status === 'overdue').length,
    waitingClient: projectActions.filter(action => action.status === 'waiting_client').length,
  }

  const orderedAxisNames = rateVersions[0]
    ? getRateProfileTemplate(rateVersions[0].profile_type).map(axis => axis.axis)
    : []

  const rateAxisByVersion = new Map(
    rateVersions.map(version => {
      const versionItems = rateItems.filter(item => item.version_id === version.id)
      const validCriteria = new Map(
        getRateProfileTemplate(version.profile_type).map(axis => [
          axis.axis,
          new Set(axis.criteria.map(criterion => criterion.criterion)),
        ])
      )
      const filteredItems = versionItems.filter(
        item => validCriteria.get(item.axis)?.has(item.criterion)
      )
      const axisScores = calculateRateAxisScores(filteredItems)
      return [version.id, new Map(axisScores.map(axis => [axis.axis, axis]))]
    })
  )

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">{project.project_name}</h1>
            <span className={cn('badge', PROJECT_STATUS_COLORS[project.status])}>
              {PROJECT_STATUS_LABELS[project.status]}
            </span>
          </div>
          <p className="page-subtitle">
            Visão consolidada do projeto com frente estratégica, ações, diagnóstico, KPIs e Rate FAUS.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/projetos" className="btn-secondary">
            Voltar
          </Link>
          <Link href={`/dashboard/projetos/${project.id}/editar`} className="btn-primary">
            <Pencil size={16} />
            Editar projeto
          </Link>
          <Link href={`/dashboard/projetos/${project.id}/diagnostico`} className="btn-secondary">
            <ClipboardList size={16} />
            {diagnosis ? 'Gerenciar diagnóstico' : 'Criar diagnóstico'}
          </Link>
          <Link href={`/dashboard/projetos/${project.id}/kpis`} className="btn-secondary">
            <BarChart3 size={16} />
            Dashboard de KPIs
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-neutral-400" />
            <p className="text-sm font-semibold text-neutral-900">Cliente</p>
          </div>
          <p className="mt-3 text-sm text-neutral-800">{client?.company_name ?? 'Cliente vinculado'}</p>
          {client && (
            <Link href={`/dashboard/clientes/${client.id}`} className="mt-3 inline-flex text-sm text-brand-600 hover:text-brand-700">
              Ver cadastro do cliente
            </Link>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2">
            <UserCircle2 size={16} className="text-neutral-400" />
            <p className="text-sm font-semibold text-neutral-900">Responsável principal</p>
          </div>
          {consultant ? (
            <>
              <p className="mt-3 text-sm font-medium text-neutral-900">{consultant.full_name}</p>
              <p className="mt-1 text-sm text-neutral-500">{consultant.email}</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">Nenhum consultor principal definido.</p>
          )}
        </div>

        <div className="card p-5">
          <p className="text-sm font-semibold text-neutral-900">Contexto do projeto</p>
          <div className="mt-3 space-y-2 text-sm text-neutral-700">
            <p><span className="text-neutral-400">Fase:</span> {PROJECT_PHASE_LABELS[project.phase]}</p>
            <p><span className="text-neutral-400">Início:</span> {formatDate(project.start_date)}</p>
            <p><span className="text-neutral-400">Término planejado:</span> {formatDate(project.planned_end_date)}</p>
            <p><span className="text-neutral-400">Progresso:</span> {project.progress_percentage}%</p>
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-neutral-900">Bloco estratégico</h2>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-xs text-neutral-400 mb-1">Foco estratégico</p>
            <p className="text-sm text-neutral-800">
              {STRATEGIC_FOCUS_LABELS[project.strategic_focus]}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">Progresso</p>
            <p className="text-sm text-neutral-800">{project.progress_percentage}%</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs text-neutral-400 mb-1">Descrição curta</p>
            <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
              {project.short_description ?? 'Nenhuma descrição resumida cadastrada.'}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs text-neutral-400 mb-1">Objetivo principal</p>
            <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
              {project.main_objective}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs text-neutral-400 mb-1">Escopo executivo</p>
            <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
              {project.executive_scope}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs text-neutral-400 mb-1">Frentes complementares</p>
            {project.complementary_workstreams && project.complementary_workstreams.length > 0 ? (
              <ul className="space-y-2 text-sm text-neutral-700">
                {project.complementary_workstreams.map(item => (
                  <li key={item} className="flex gap-2">
                    <span className="text-brand-600">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500">Nenhuma frente complementar registrada.</p>
            )}
          </div>
          <div className="md:col-span-2">
            <p className="text-xs text-neutral-400 mb-1">Exclusões de escopo</p>
            <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
              {project.scope_exclusions ?? 'Nenhuma exclusão explicitada.'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckSquare size={16} className="text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-900">Resumo de ações</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: 'Ações pendentes',
              value: actionSummary.pending,
              href: `/dashboard/acoes?projectId=${project.id}&statusGroup=pending`,
              colors: 'border-sky-100 bg-sky-50 text-sky-700',
            },
            {
              label: 'Ações atrasadas',
              value: actionSummary.overdue,
              href: `/dashboard/acoes?projectId=${project.id}&statusGroup=overdue`,
              colors: 'border-red-100 bg-red-50 text-red-700',
            },
            {
              label: 'Aguardando cliente',
              value: actionSummary.waitingClient,
              href: `/dashboard/acoes?projectId=${project.id}&statusGroup=waiting_client`,
              colors: 'border-amber-100 bg-amber-50 text-amber-700',
            },
          ].map(item => (
            <Link
              key={item.label}
              href={item.href}
              className={`card border p-5 transition hover:-translate-y-0.5 ${item.colors}`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold">{item.value}</p>
              <p className="mt-2 text-sm opacity-80">Abrir ações filtradas deste projeto</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="card p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-neutral-400" />
            <h2 className="text-sm font-semibold text-neutral-900">Diagnóstico</h2>
          </div>
          {diagnosis && (
            <span className={cn('badge', DIAGNOSIS_STATUS_COLORS[diagnosis.status])}>
              {DIAGNOSIS_STATUS_LABELS[diagnosis.status]}
            </span>
          )}
        </div>

        {diagnosis ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs text-neutral-400 mb-1">Período</p>
                <p className="text-sm text-neutral-700">
                  {formatDate(diagnosis.start_date)} até {formatDate(diagnosis.end_date)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 mb-1">Responsável</p>
                <p className="text-sm text-neutral-700">{diagnosisOwner?.full_name ?? 'Não definido'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-neutral-400 mb-1">Resumo executivo</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                  {diagnosis.executive_summary ?? 'Resumo ainda não registrado.'}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-neutral-400 mb-1">Principais achados</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                  {diagnosis.key_findings ?? 'Achados ainda não registrados.'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-neutral-900">KPIs do projeto</h3>
                <span className="text-xs text-neutral-400">{kpiRows.length} cadastrados</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    <tr>
                      <th className="px-4 py-3">KPI</th>
                      <th className="px-4 py-3">Origem / baseline</th>
                      <th className="px-4 py-3">Meta atual</th>
                      <th className="px-4 py-3">Realizado</th>
                      <th className="px-4 py-3">Farol</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 bg-white">
                    {kpiRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-sm text-neutral-500">
                          Nenhum KPI cadastrado para este projeto.
                        </td>
                      </tr>
                    ) : (
                      kpiRows.map(row => (
                        <tr key={row.id} className="transition-colors hover:bg-neutral-50">
                          <td className="px-4 py-3">
                            <Link href={`/dashboard/kpis/${row.id}`} className="font-medium text-neutral-900 hover:text-brand-700">
                              {row.kpi_name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-neutral-700">
                            <div>{KPI_ORIGIN_TYPE_LABELS[row.origin_type]}</div>
                            {row.diagnosisIndicator && (
                              <div className="mt-1 text-xs text-neutral-400">
                                {formatMeasurementValue(row.diagnosisIndicator.baseline_value, row.diagnosisIndicator.unit_of_measure)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-neutral-700">
                            {row.currentPeriod
                              ? formatMeasurementValue(row.currentPeriod.planned_target, row.unit_of_measure)
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-neutral-700">
                            {row.currentRecord
                              ? formatMeasurementValue(row.currentRecord.actual_value, row.unit_of_measure)
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {row.currentRecord ? (
                              <span className={cn('badge', PERFORMANCE_STATUS_COLORS[row.currentRecord.calculated_status])}>
                                {PERFORMANCE_STATUS_LABELS[row.currentRecord.calculated_status]}
                              </span>
                            ) : (
                              <span className="text-neutral-400">Sem apuração</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('badge', KPI_STATUS_COLORS[row.status])}>
                              {KPI_STATUS_LABELS[row.status]}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900">Rate FAUS</h3>
                  <p className="mt-1 text-xs text-neutral-400">Resumo consolidado por versão e comparativo por eixo.</p>
                </div>
                <Link href={`/dashboard/projetos/${project.id}/diagnostico/rate`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                  Abrir Rate completo
                </Link>
              </div>

              {rateAssessment && rateVersions.length > 0 ? (
                <div className="space-y-5 p-4">
                  <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Rate Total atual</p>
                    <p className="mt-3 text-3xl font-semibold text-brand-900">
                      {formatRateScore(rateVersions[rateVersions.length - 1]?.overall_score ?? null)}
                      <span className="text-base font-medium text-brand-700"> / 5,0</span>
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-neutral-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        <tr>
                          <th className="px-4 py-3">Versão</th>
                          <th className="px-4 py-3">Nome</th>
                          <th className="px-4 py-3">Data</th>
                          <th className="px-4 py-3">Score geral</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 bg-white">
                        {rateVersions.map(version => (
                          <tr key={version.id} className="transition-colors hover:bg-neutral-50">
                            <td className="px-4 py-3">
                              <Link href={`/dashboard/projetos/${project.id}/diagnostico/rate?version=${version.id}`} className="font-medium text-neutral-900 hover:text-brand-700">
                                v{version.version_number}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-neutral-700">{version.version_name}</td>
                            <td className="px-4 py-3 text-neutral-700">{formatDate(version.assessment_date)}</td>
                            <td className="px-4 py-3 text-neutral-700">{formatRateScore(version.overall_score)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-neutral-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        <tr>
                          <th className="px-4 py-3">Eixo</th>
                          {rateVersions.map(version => (
                            <th key={version.id} className="px-4 py-3">
                              v{version.version_number}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 bg-white">
                        {orderedAxisNames.map(axis => (
                          <tr key={axis} className="transition-colors hover:bg-neutral-50">
                            <td className="px-4 py-3">
                              <Link href={`/dashboard/projetos/${project.id}/diagnostico/rate`} className="font-medium text-neutral-900 hover:text-brand-700">
                                {axis}
                              </Link>
                            </td>
                            {rateVersions.map(version => (
                              <td key={`${axis}-${version.id}`} className="px-4 py-3 text-neutral-700">
                                {formatRateScore(rateAxisByVersion.get(version.id)?.get(axis)?.score ?? null)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-6 text-sm text-neutral-500">
                  Nenhum Rate FAUS ativo para este diagnóstico.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-neutral-200">
              <div className="flex flex-col gap-3 border-b border-neutral-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900">Performance mensal dos KPIs</h3>
                  <p className="mt-1 text-xs text-neutral-400">
                    Todos os KPIs vinculados ao projeto, com referência, meta, apuração e atalho para FSP por mês.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {availableYears.map(year => (
                    <Link
                      key={year}
                      href={`/dashboard/projetos/${project.id}?year=${year}`}
                      className={cn(
                        'btn-ghost',
                        selectedYear === year && 'bg-neutral-900 text-white hover:bg-neutral-800'
                      )}
                    >
                      {year}
                    </Link>
                  ))}
                </div>
              </div>

              {kpiRows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-neutral-500">
                  Nenhum KPI cadastrado para este projeto.
                </div>
              ) : (
                <div className="space-y-6 p-4">
                  {kpiRows.map(row => {
                    const referenceValue = row.diagnosisIndicator
                      ? formatMeasurementValue(
                          row.diagnosisIndicator.baseline_value,
                          row.diagnosisIndicator.unit_of_measure ?? row.unit_of_measure
                        )
                      : '—'

                    return (
                      <div key={row.id} className="overflow-x-auto rounded-2xl border border-neutral-200">
                        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                          <div>
                            <Link href={`/dashboard/kpis/${row.id}`} className="text-sm font-semibold text-neutral-900 hover:text-brand-700">
                              {row.kpi_name}
                            </Link>
                            <p className="mt-1 text-xs text-neutral-400">
                              {KPI_ORIGIN_TYPE_LABELS[row.origin_type]} · {row.visible_to_client ? 'Visível ao cliente' : 'Uso interno'}
                            </p>
                          </div>
                          <span className={cn('badge', KPI_STATUS_COLORS[row.status])}>
                            {KPI_STATUS_LABELS[row.status]}
                          </span>
                        </div>

                        <table className="min-w-[1200px] w-full text-sm">
                          <thead className="bg-white text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                            <tr>
                              <th className="px-4 py-3">Série</th>
                              <th className="px-4 py-3">Valor de referência</th>
                              {KPI_MONTH_OPTIONS.map(month => (
                                <th key={`${row.id}-${month.index}`} className="px-3 py-3 text-center">
                                  {getMonthPeriodLabel(selectedYear, month.index)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 bg-white">
                            <tr>
                              <td className="px-4 py-4 font-semibold text-neutral-900">Referência / Diagnóstico</td>
                              <td className="px-4 py-4 text-sm font-medium text-neutral-800">{referenceValue}</td>
                              {KPI_MONTH_OPTIONS.map(month => (
                                <td key={`reference-${row.id}-${month.index}`} className="px-3 py-4 text-center text-neutral-300">
                                  —
                                </td>
                              ))}
                            </tr>

                            <tr>
                              <td className="px-4 py-4 font-semibold text-neutral-900">Meta</td>
                              <td className="px-4 py-4 text-neutral-300">—</td>
                              {row.monthRows.map(({ month, period }) => (
                                <td key={`target-${row.id}-${month.index}`} className="px-3 py-4 text-center">
                                  {period ? (
                                    <span className="font-medium text-neutral-900">
                                      {formatMeasurementValue(period.planned_target, row.unit_of_measure)}
                                    </span>
                                  ) : (
                                    <span className="text-neutral-300">—</span>
                                  )}
                                </td>
                              ))}
                            </tr>

                            <tr>
                              <td className="px-4 py-4 font-semibold text-neutral-900">Realizado / Apuração</td>
                              <td className="px-4 py-4 text-neutral-300">—</td>
                              {row.monthRows.map(({ month, period, record, linkedFsp }) => {
                                const actionHref = !period
                                  ? null
                                  : record
                                    ? linkedFsp
                                      ? `/dashboard/fsps/${linkedFsp.id}`
                                      : `/dashboard/fsps/novo?sourceType=kpi_period&recordId=${record.id}`
                                    : `/dashboard/kpis/periodos/${period.id}/apuracao`

                                const actionLabel = !period
                                  ? null
                                  : record
                                    ? 'Abrir FSP'
                                    : 'Apurar'

                                return (
                                  <td key={`actual-${row.id}-${month.index}`} className="px-2 py-3 text-center align-top">
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
                                            ? formatMeasurementValue(record.actual_value, row.unit_of_measure)
                                            : '—'}
                                        </p>
                                        <div className="mt-1 space-y-1">
                                          <p className="text-[11px] text-neutral-500">
                                            {record
                                              ? PERFORMANCE_STATUS_LABELS[record.calculated_status]
                                              : 'Sem apuração'}
                                          </p>
                                          {actionHref && actionLabel && (
                                            <Link
                                              href={actionHref}
                                              className="inline-block text-[11px] font-medium text-brand-700 hover:text-brand-800"
                                            >
                                              {actionLabel}
                                            </Link>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-neutral-300">—</span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-neutral-500">
              Este projeto ainda não possui diagnóstico principal registrado.
            </p>
            <Link href={`/dashboard/projetos/${project.id}/diagnostico`} className="btn-primary">
              <ClipboardList size={16} />
              Criar diagnóstico
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
