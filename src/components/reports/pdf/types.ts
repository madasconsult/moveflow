import type { ActionStatus, MeetingType, ProjectPhase, ProjectStatus } from '@/types/database.types'

export type ReportType = 'executive' | 'weekly' | 'actions'

export interface ReportAssets {
  logoWhite?: string | null
  logoBlack?: string | null
}

export interface ReportProject {
  id: string
  project_name: string
  short_description: string | null
  main_objective: string | null
  executive_scope: string | null
  status: ProjectStatus
  phase: ProjectPhase
  progress_percentage: number | null
  client_name: string | null
}

export interface ReportAction {
  id: string
  business_id: string | null
  title: string
  description: string | null
  assigned_to: string | null
  responsible_name: string | null
  status: ActionStatus
  priority: string
  due_date: string | null
  completion_date: string | null
  created_at: string
}

export interface ReportMeeting {
  id: string
  meeting_date: string
  meeting_type: MeetingType
  executive_summary: string | null
  participants: string[] | null
}

export interface ReportPeriod {
  startDate: string
  endDate: string
}

export interface ReportData {
  generatedAt: string
  period: ReportPeriod
  project: ReportProject
  actions: ReportAction[]
  meetings: ReportMeeting[]
  assets?: ReportAssets
  consultantComment?: string | null
}
