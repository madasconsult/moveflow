import { getActiveProjectContext } from '@/lib/active-project/server'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database.types'
import type {
  ReportAction,
  ReportConsultingData,
  ReportData,
  ReportDiagnosis,
  ReportDiaryDeliverable,
  ReportDiaryEntry,
  ReportFsp,
  ReportKpi,
  ReportKpiRecord,
  ReportKpiTarget,
  ReportMeeting,
  ReportProject,
  ReportRateItem,
  ReportRateVersion,
  ReportType,
} from '@/components/reports/pdf/types'

export const REPORT_TYPES: ReportType[] = ['executive', 'weekly', 'actions']

export function canAccessReports(profile: Profile) {
  const role = profile.role as string
  return role === 'admin_faus' || role === 'consultor_faus' || role === 'consultor'
}

export function isReportType(value: string): value is ReportType {
  return REPORT_TYPES.includes(value as ReportType)
}

export function normalizeReportPeriod(startDate: string | null, endDate: string | null) {
  const today = new Date()
  const fallbackEnd = today.toISOString().slice(0, 10)
  const fallbackStart = new Date(today)
  fallbackStart.setDate(today.getDate() - 7)

  const start = startDate || fallbackStart.toISOString().slice(0, 10)
  const end = endDate || fallbackEnd

  if (start > end) {
    return { startDate: end, endDate: start }
  }

  return { startDate: start, endDate: end }
}

export async function validateReportProjectAccess(profile: Profile, projectId: string) {
  const activeProjectContext = await getActiveProjectContext(profile)
  return activeProjectContext.projects.find(project => project.id === projectId) ?? null
}

interface ProjectQueryRow {
  id: string
  project_name: string
  short_description: string | null
  main_objective: string | null
  executive_scope: string | null
  status: ReportProject['status']
  phase: ReportProject['phase']
  progress_percentage: number | null
  clients: { company_name: string | null } | { company_name: string | null }[] | null
}

interface ActionQueryRow {
  id: string
  business_id: string | null
  title: string
  description: string | null
  assigned_to: string | null
  status: ReportAction['status']
  priority: string
  due_date: string | null
  completion_date: string | null
  created_at: string
}

interface MeetingQueryRow {
  id: string
  meeting_date: string
  meeting_type: ReportMeeting['meeting_type']
  executive_summary: string | null
  participants: string[] | null
}

interface ProfileLookup {
  id: string
  full_name: string
}

interface RateAssessmentLookup {
  id: string
}

export async function loadReportData(projectId: string, startDate: string, endDate: string): Promise<ReportData | null> {
  const supabase = await createClient()

  const projectsTable = supabase.from('projects') as any
  const projectRes = await projectsTable
    .select('id, project_name, short_description, main_objective, executive_scope, status, phase, progress_percentage, clients(company_name)')
    .eq('id', projectId)
    .single()

  if (projectRes.error || !projectRes.data) {
    return null
  }

  const projectRow = projectRes.data as unknown as ProjectQueryRow
  const client = Array.isArray(projectRow.clients) ? projectRow.clients[0] : projectRow.clients
  const project: ReportProject = {
    id: projectRow.id,
    project_name: projectRow.project_name,
    short_description: projectRow.short_description,
    main_objective: projectRow.main_objective,
    executive_scope: projectRow.executive_scope,
    status: projectRow.status,
    phase: projectRow.phase,
    progress_percentage: projectRow.progress_percentage,
    client_name: client?.company_name ?? null,
  }

  const [actionsRes, meetingsRes] = await Promise.all([
    supabase
      .from('actions')
      .select('id, business_id, title, description, assigned_to, status, priority, due_date, completion_date, created_at')
      .eq('project_id', projectId)
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('meetings')
      .select('id, meeting_date, meeting_type, executive_summary, participants')
      .eq('project_id', projectId)
      .order('meeting_date', { ascending: false }),
  ])

  const actionRows = actionsRes.error ? [] : ((actionsRes.data as unknown as ActionQueryRow[] | null) ?? [])
  const responsibleIds = Array.from(new Set(actionRows.map(action => action.assigned_to).filter(Boolean) as string[]))
  const profilesRes = responsibleIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', responsibleIds)
    : { data: [] as ProfileLookup[] | null, error: null }

  const profileMap = new Map(
    (((profilesRes.data as ProfileLookup[] | null) ?? [])).map(profile => [profile.id, profile.full_name])
  )

  const actions: ReportAction[] = actionRows.map(action => ({
    ...action,
    responsible_name: action.assigned_to ? profileMap.get(action.assigned_to) ?? null : null,
  }))

  const meetings: ReportMeeting[] = meetingsRes.error
    ? []
    : ((meetingsRes.data as unknown as MeetingQueryRow[] | null) ?? []).map(meeting => ({
        id: meeting.id,
        meeting_date: meeting.meeting_date,
        meeting_type: meeting.meeting_type,
        executive_summary: meeting.executive_summary,
        participants: meeting.participants,
      }))
  const consulting = await loadReportConsultingData(projectId, startDate, endDate)

  return {
    generatedAt: new Date().toISOString(),
    period: { startDate, endDate },
    project,
    actions,
    meetings,
    consulting,
  }
}

export async function loadReportConsultingData(
  projectId: string,
  startDate: string,
  endDate: string
): Promise<ReportConsultingData> {
  const supabase = await createClient()

  const [kpisRes, fspsRes, diagnosisRes, diaryEntriesRes] = await Promise.all([
    supabase
      .from('kpis')
      .select('id, kpi_name, diagnosis_indicator_id, unit_of_measure, status, trend, reading_type, origin_type, target_value, current_value')
      .eq('project_id', projectId)
      .order('kpi_name'),
    supabase
      .from('fsps')
      .select('id, title, source_type, kpi_id, kpi_period_record_id, action_id, linked_action_id, generated_action_id, problem_statement, impact, method_type, root_cause, probable_cause, recommendation, status, opened_at, closed_at')
      .eq('project_id', projectId)
      .order('opened_at', { ascending: false }),
    supabase
      .from('project_diagnoses')
      .select('id, start_date, end_date, executive_summary, key_findings, initial_hypotheses, status')
      .eq('project_id', projectId)
      .maybeSingle(),
    supabase
      .from('diary_entries')
      .select('id, title, start_date, end_date, faus_people')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .lte('start_date', endDate)
      .gte('end_date', startDate)
      .order('start_date', { ascending: false }),
  ])

  const kpis = kpisRes.error ? [] : ((kpisRes.data as ReportKpi[] | null) ?? [])
  const kpiIds = kpis.map(kpi => kpi.id)
  const fsps = (fspsRes.error ? [] : ((fspsRes.data as ReportFsp[] | null) ?? [])).filter(fsp =>
    isDateWithinPeriod(fsp.opened_at, startDate, endDate) ||
    isDateWithinPeriod(fsp.closed_at, startDate, endDate) ||
    fsp.status === 'aberta' ||
    fsp.status === 'em_analise'
  )
  const diagnosis = diagnosisRes.error ? null : ((diagnosisRes.data as ReportDiagnosis | null) ?? null)
  const diaryEntries = diaryEntriesRes.error ? [] : ((diaryEntriesRes.data as ReportDiaryEntry[] | null) ?? [])
  const diaryEntryIds = diaryEntries.map(entry => entry.id)

  const [targetsRes, recordsRes, rateAssessmentRes, deliverablesRes] = await Promise.all([
    kpiIds.length > 0
      ? supabase
          .from('kpi_target_periods')
          .select('id, kpi_id, period_label, start_date, end_date, planned_target')
          .in('kpi_id', kpiIds)
          .lte('start_date', endDate)
          .gte('end_date', startDate)
          .order('start_date', { ascending: true })
      : Promise.resolve({ data: [] as ReportKpiTarget[] | null, error: null }),
    kpiIds.length > 0
      ? supabase
          .from('kpi_period_records')
          .select('id, kpi_id, target_period_id, competence, actual_value, calculated_status, justification, short_analysis, recorded_at')
          .in('kpi_id', kpiIds)
          .gte('recorded_at', startDate)
          .lte('recorded_at', `${endDate}T23:59:59.999Z`)
          .order('recorded_at', { ascending: false })
      : Promise.resolve({ data: [] as ReportKpiRecord[] | null, error: null }),
    diagnosis
      ? supabase
          .from('rate_assessments')
          .select('id')
          .eq('diagnosis_id', diagnosis.id)
          .maybeSingle()
      : Promise.resolve({ data: null as RateAssessmentLookup | null, error: null }),
    diaryEntryIds.length > 0
      ? supabase
          .from('diary_deliverables')
          .select('diary_entry_id, description, position')
          .in('diary_entry_id', diaryEntryIds)
          .order('position', { ascending: true })
      : Promise.resolve({ data: [] as ReportDiaryDeliverable[] | null, error: null }),
  ])

  const kpiTargets = targetsRes.error ? [] : ((targetsRes.data as ReportKpiTarget[] | null) ?? [])
  const kpiRecords = recordsRes.error ? [] : ((recordsRes.data as ReportKpiRecord[] | null) ?? [])
  const rateAssessment = rateAssessmentRes.error ? null : ((rateAssessmentRes.data as RateAssessmentLookup | null) ?? null)
  const diaryDeliverables = deliverablesRes.error ? [] : ((deliverablesRes.data as ReportDiaryDeliverable[] | null) ?? [])

  const versionsRes = rateAssessment
    ? await supabase
        .from('rate_assessment_versions')
        .select('id, version_number, version_name, assessment_date, profile_type, overall_score')
        .eq('assessment_id', rateAssessment.id)
        .order('version_number', { ascending: false })
    : { data: [] as ReportRateVersion[] | null, error: null }

  const rateVersions = versionsRes.error ? [] : ((versionsRes.data as ReportRateVersion[] | null) ?? [])
  const versionIds = rateVersions.map(version => version.id)
  const itemsRes = versionIds.length > 0
    ? await supabase
        .from('rate_assessment_items')
        .select('version_id, axis, criterion, weight, score')
        .in('version_id', versionIds)
    : { data: [] as ReportRateItem[] | null, error: null }

  return {
    kpis,
    kpiTargets,
    kpiRecords,
    fsps,
    diagnosis,
    rateVersions,
    rateItems: itemsRes.error ? [] : ((itemsRes.data as ReportRateItem[] | null) ?? []),
    diaryEntries,
    diaryDeliverables,
  }
}

function isDateWithinPeriod(value: string | null | undefined, startDate: string, endDate: string) {
  if (!value) return false
  const normalizedValue = value.slice(0, 10)
  return normalizedValue >= startDate && normalizedValue <= endDate
}
