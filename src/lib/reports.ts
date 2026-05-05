import { getActiveProjectContext } from '@/lib/active-project/server'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database.types'
import type { ReportAction, ReportData, ReportMeeting, ReportProject, ReportType } from '@/components/reports/pdf/types'

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

  return {
    generatedAt: new Date().toISOString(),
    period: { startDate, endDate },
    project,
    actions,
    meetings,
  }
}
