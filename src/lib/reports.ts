import { getActiveProjectContext } from '@/lib/active-project/server'
import { createClient } from '@/lib/supabase/server'
import { canAccessInternalReports } from '@/lib/utils'
import type { Profile } from '@/types/database.types'
import type { ReportAction, ReportData, ReportMeeting, ReportProject, ReportType } from '@/components/reports/pdf/types'

export const REPORT_TYPES: ReportType[] = ['executive', 'weekly', 'actions']

export function canAccessReports(profile: Profile) {
  return canAccessInternalReports(profile.role)
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

export async function loadReportData(projectId: string, startDate: string, endDate: string): Promise<ReportData | null> {
  const supabase = await createClient()

  // Supabase generated types don't model the clients join shape, so we bypass the query builder type here.
  const projectRes = await (supabase.from('projects') as any)
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

  // endDate with time suffix to safely include the full final day on timestamptz columns
  const endDatetime = `${endDate}T23:59:59.999Z`

  // Relevance filter for actions — three OR-grouped conditions:
  //
  // A) Active actions (status ≠ completed/cancelled) created before the period ended.
  //    Covers: in_progress, overdue, not_started, waiting_client, waiting_faus — including
  //    historically overdue actions still open at the start of the period.
  //
  // B) Actions with due_date within the period (any status).
  //    Catches cancelled actions whose deadline falls in the period, since there is no
  //    cancelled_at field. Cancelled actions without a due_date in the period are excluded
  //    (known limitation — no reliable cancellation date available).
  //
  // C) Actions completed within the period (completion_date between start and end).
  //
  // Excluded (histórico morto):
  //   — completed actions with completion_date before startDate
  //   — cancelled actions with due_date before startDate or without due_date
  //   — active actions created after endDate (edge case: future-created placeholders)
  const actionsOrFilter = [
    `and(status.not.in.(completed,cancelled),created_at.lte.${endDatetime})`,
    `and(due_date.gte.${startDate},due_date.lte.${endDate})`,
    `and(completion_date.gte.${startDate},completion_date.lte.${endDatetime})`,
  ].join(',')

  const [actionsRes, meetingsRes] = await Promise.all([
    supabase
      .from('actions')
      .select('id, business_id, title, description, assigned_to, status, priority, due_date, completion_date, created_at')
      .eq('project_id', projectId)
      .or(actionsOrFilter)
      .order('due_date', { ascending: true, nullsFirst: false }),
    // Meetings filtered to the selected period at DB level.
    // The executive report metric is updated to "Reuniões no período" to reflect this scope.
    supabase
      .from('meetings')
      .select('id, meeting_date, meeting_type, executive_summary, participants')
      .eq('project_id', projectId)
      .gte('meeting_date', startDate)
      .lte('meeting_date', endDatetime)
      .order('meeting_date', { ascending: false }),
  ])

  // DB errors on actions or meetings abort the report — an empty result from a failed query
  // would silently generate a misleading PDF with no data.
  if (actionsRes.error) return null
  if (meetingsRes.error) return null

  const actionRows = (actionsRes.data as unknown as ActionQueryRow[] | null) ?? []
  const responsibleIds = Array.from(new Set(actionRows.map(action => action.assigned_to).filter(Boolean) as string[]))
  const profilesRes = responsibleIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', responsibleIds)
    : { data: [] as ProfileLookup[] | null, error: null }

  // Profile lookup failure degrades gracefully: responsible_name shows as null rather than
  // aborting the entire report, since names are supplementary display data.
  const profileMap = new Map(
    ((profilesRes.data as ProfileLookup[] | null) ?? []).map(profile => [profile.id, profile.full_name])
  )

  const actions: ReportAction[] = actionRows.map(action => ({
    ...action,
    responsible_name: action.assigned_to ? profileMap.get(action.assigned_to) ?? null : null,
  }))

  const meetings: ReportMeeting[] = ((meetingsRes.data as unknown as MeetingQueryRow[] | null) ?? []).map(meeting => ({
    id: meeting.id,
    meeting_date: meeting.meeting_date,
    meeting_type: meeting.meeting_type,
    executive_summary: meeting.executive_summary,
    participants: meeting.participants,
  }))

  return {
    generatedAt: new Date().toISOString(),
    period: { startDate, endDate },
    project,
    actions,
    meetings,
  }
}
