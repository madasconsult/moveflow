import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, BarChart3, Building2, CheckSquare, ClipboardList, Pencil, UserCircle2 } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { RateAxisLineChart } from '@/components/diagnosis/RateAxisLineChart'
import { RateGauge } from '@/components/diagnosis/RateGauge'
import { RateRadarChart } from '@/components/diagnosis/RateRadarChart'
import { ProjectKpiExecutiveCard } from '@/components/projects/ProjectKpiExecutiveCard'
import { ProjectSupportTeamManager } from '@/components/projects/ProjectSupportTeamManager'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import {
  DIAGNOSIS_STATUS_COLORS,
  DIAGNOSIS_STATUS_LABELS,
  FAUS_BRANCH_LABELS,
  KPI_MONTH_OPTIONS,
  KPI_ORIGIN_TYPE_LABELS,
  KPI_STATUS_COLORS,
  KPI_STATUS_LABELS,
  PROJECT_PHASE_LABELS,
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  STRATEGIC_FOCUS_LABELS,
  getMonthIndexFromDate,
  getMonthPeriodLabel,
  getYearFromDate,
  cn,
  formatDate,
} from '@/lib/utils'
import {
  buildRateAxisCriterionSeries,
  calculateRateAxisScores,
  getRateProfileTemplate,
  type RateAxisScore,
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
  ProjectMember,
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
type ProjectManagerLookup = Pick<Profile, 'id' | 'full_name'>
type SupportProfileLookup = Pick<Profile, 'id' | 'full_name' | 'email'>
type SupportMemberLookup = Pick<
  ProjectMember,
  'id' | 'project_id' | 'user_id' | 'role_in_project' | 'specialty' | 'added_by' | 'created_at'
>
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

  const [
    clientRes,
    consultantRes,
    managerRes,
    supportMembersRes,
    eligibleSupportUsersRes,
    diagnosisRes,
    actionsRes,
    kpisRes,
  ] = await Promise.all([
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
    project.project_manager_id
      ? supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', project.project_manager_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from('project_members')
      .select('id, project_id, user_id, role_in_project, specialty, added_by, created_at')
      .eq('project_id', project.id)
      .eq('role_in_project', 'support'),
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('role', ['admin_faus', 'gestor_faus', 'consultor_faus'])
      .eq('is_active', true)
      .order('full_name'),
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
  const projectManager = (managerRes.data as ProjectManagerLookup | null) ?? null
  const supportMembers = (supportMembersRes.data as SupportMemberLookup[] | null) ?? []
  const eligibleSupportUsers = (eligibleSupportUsersRes.data as SupportProfileLookup[] | null) ?? []
  const diagnosis = (diagnosisRes.data as ProjectDiagnosis | null) ?? null
  const projectActions = (actionsRes.data as ActionLookup[] | null) ?? []
  const kpis = (kpisRes.data as KpiLookup[] | null) ?? []

  const supportUserIds = Array.from(new Set(supportMembers.map(member => member.user_id)))
  const supportProfilesRes =
    supportUserIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', supportUserIds)
      : { data: [] as SupportProfileLookup[] | null }
  const supportProfiles = (supportProfilesRes.data as SupportProfileLookup[] | null) ?? []
  const supportProfileMap = new Map(supportProfiles.map(profile => [profile.id, profile]))
  const supportTeam = supportMembers
    .map(member => ({
      ...member,
      profile: supportProfileMap.get(member.user_id) ?? null,
    }))
    .sort((firstMember, secondMember) =>
      (firstMember.profile?.full_name ?? 'Usuário vinculado').localeCompare(
        secondMember.profile?.full_name ?? 'Usuário vinculado',
        'pt-BR'
      )
    )

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
  const latestRateVersion = rateVersions[rateVersions.length - 1] ?? null
  const latestRateAxisScores: RateAxisScore[] = latestRateVersion
    ? orderedAxisNames
        .map(axis => rateAxisByVersion.get(latestRateVersion.id)?.get(axis))
        .filter((axis): axis is RateAxisScore => Boolean(axis))
    : []
  const rateAxisCriterionSeries = buildRateAxisCriterionSeries(rateVersions, rateItems)

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
            <p><span className="text-neutral-400">Tipo:</span> {project.project_type ? PROJECT_TYPE_LABELS[project.project_type] : 'Não definido'}</p>
            <p><span className="text-neutral-400">Filial:</span> {project.branch ? FAUS_BRANCH_LABELS[project.branch] : 'Não definida'}</p>
            <p><span className="text-neutral-400">Gestor:</span> {projectManager?.full_name ?? 'Não definido'}</p>
            <p><span className="text-neutral-400">Início:</span> {formatDate(project.start_date)}</p>
            <p><span className="text-neutral-400">Término planejado:</span> {formatDate(project.planned_end_date)}</p>
            <p><span className="text-neutral-400">Progresso:</span> {project.progress_percentage}%</p>
          </div>
        </div>
      </div>

      <ProjectSupportTeamManager
        projectId={project.id}
        mainConsultantId={project.main_consultant_id}
        currentUserId={session.profile.id}
        canManage={session.profile.role === 'admin_faus'}
        supportMembers={supportTeam}
        eligibleUsers={eligibleSupportUsers}
      />

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
              <div className="flex flex-col gap-3 border-b border-neutral-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900">KPIs do projeto</h3>
                  <p className="mt-1 text-xs text-neutral-400">
                    Leitura gráfica executiva dos indicadores no ano selecionado.
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
                <div className="grid gap-4 p-4 xl:grid-cols-2">
                  {kpiRows.map(row => (
                    <ProjectKpiExecutiveCard
                      key={row.id}
                      href={`/dashboard/kpis/${row.id}`}
                      name={row.kpi_name}
                      originLabel={KPI_ORIGIN_TYPE_LABELS[row.origin_type]}
                      statusLabel={KPI_STATUS_LABELS[row.status]}
                      statusClassName={KPI_STATUS_COLORS[row.status]}
                      referenceValue={row.diagnosisIndicator?.baseline_value ?? null}
                      referenceUnit={row.diagnosisIndicator?.unit_of_measure ?? row.unit_of_measure}
                      unit={row.unit_of_measure}
                      points={row.monthRows.map(({ month, period, record }) => ({
                        label: getMonthPeriodLabel(selectedYear, month.index),
                        target: period?.planned_target ?? null,
                        actual: record?.actual_value ?? null,
                      }))}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-neutral-200">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900">Rate FAUS</h3>
                  <p className="mt-1 text-xs text-neutral-400">
                    Gráficos clicáveis para leitura executiva do Rate e suas aberturas por eixo.
                  </p>
                </div>
                <Link href={`/dashboard/projetos/${project.id}/diagnostico/rate`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                  Abrir Rate completo
                </Link>
              </div>

              {rateAssessment && rateVersions.length > 0 && latestRateVersion ? (
                <div className="space-y-5 p-4">
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Link
                      href={`/dashboard/projetos/${project.id}/graficos/rate/geral`}
                      className="group block rounded-[28px] transition hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <RateGauge score={latestRateVersion.overall_score} />
                      <span className="mt-2 inline-flex items-center gap-1 px-2 text-xs font-medium text-brand-700">
                        Ver detalhe do Rate Geral
                        <ArrowUpRight size={13} />
                      </span>
                    </Link>

                    <Link
                      href={`/dashboard/projetos/${project.id}/graficos/rate/eixos`}
                      className="group block rounded-[28px] transition hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <RateRadarChart axes={latestRateAxisScores} compact />
                      <span className="mt-2 inline-flex items-center gap-1 px-2 text-xs font-medium text-brand-700">
                        Ver detalhe do Radar por Eixo
                        <ArrowUpRight size={13} />
                      </span>
                    </Link>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {rateAxisCriterionSeries.map(axisSeries => (
                      <Link
                        key={axisSeries.axis}
                        href={`/dashboard/projetos/${project.id}/graficos/rate/eixos/${encodeURIComponent(axisSeries.axis)}`}
                        className="group block rounded-[28px] transition hover:-translate-y-0.5 hover:shadow-lg"
                      >
                        <RateAxisLineChart series={axisSeries} compact />
                        <span className="mt-2 inline-flex items-center gap-1 px-2 text-xs font-medium text-brand-700">
                          Detalhar {axisSeries.axis}
                          <ArrowUpRight size={13} />
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-4 py-6 text-sm text-neutral-500">
                  Nenhum Rate FAUS ativo para este diagnóstico.
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
