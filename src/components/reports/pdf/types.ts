import type {
  ActionStatus,
  DiagnosisStatus,
  FspMethodType,
  FspSourceType,
  FspStatus,
  KpiOriginType,
  KpiReadingType,
  KpiStatus,
  KpiTrend,
  MeetingType,
  PerformanceStatus,
  ProjectPhase,
  ProjectStatus,
  RateProfileType,
} from '@/types/database.types'

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

export interface ReportKpi {
  id: string
  kpi_name: string
  diagnosis_indicator_id: string | null
  unit_of_measure: string | null
  status: KpiStatus
  trend: KpiTrend | null
  reading_type: KpiReadingType
  origin_type: KpiOriginType
  target_value: number | null
  current_value: number | null
}

export interface ReportKpiTarget {
  id: string
  kpi_id: string
  period_label: string
  start_date: string
  end_date: string
  planned_target: number
}

export interface ReportKpiRecord {
  id: string
  kpi_id: string
  target_period_id: string
  competence: string
  actual_value: number
  calculated_status: PerformanceStatus
  justification: string | null
  short_analysis: string | null
  recorded_at: string
}

export interface ReportFsp {
  id: string
  title: string
  source_type: FspSourceType
  kpi_id: string | null
  kpi_period_record_id: string | null
  action_id: string | null
  linked_action_id: string | null
  generated_action_id: string | null
  problem_statement: string
  impact: string | null
  method_type: FspMethodType
  root_cause: string | null
  probable_cause: string | null
  recommendation: string | null
  status: FspStatus
  opened_at: string
  closed_at: string | null
}

export interface ReportDiagnosis {
  id: string
  start_date: string | null
  end_date: string | null
  executive_summary: string | null
  key_findings: string | null
  initial_hypotheses: string | null
  status: DiagnosisStatus
}

export interface ReportRateVersion {
  id: string
  version_number: number
  version_name: string
  assessment_date: string
  profile_type: RateProfileType
  overall_score: number | null
}

export interface ReportRateItem {
  version_id: string
  axis: string
  criterion: string
  weight: number
  score: number | null
}

export interface ReportDiaryEntry {
  id: string
  title: string
  start_date: string
  end_date: string
  faus_people: string[]
}

export interface ReportDiaryDeliverable {
  diary_entry_id: string
  description: string
  position: number
}

export interface ReportConsultingData {
  kpis: ReportKpi[]
  kpiTargets: ReportKpiTarget[]
  kpiRecords: ReportKpiRecord[]
  fsps: ReportFsp[]
  diagnosis: ReportDiagnosis | null
  rateVersions: ReportRateVersion[]
  rateItems: ReportRateItem[]
  diaryEntries: ReportDiaryEntry[]
  diaryDeliverables: ReportDiaryDeliverable[]
}

export interface ReportData {
  generatedAt: string
  period: ReportPeriod
  project: ReportProject
  actions: ReportAction[]
  meetings: ReportMeeting[]
  consulting?: ReportConsultingData
  assets?: ReportAssets
  consultantComment?: string | null
}
