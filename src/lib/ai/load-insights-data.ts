/**
 * AI Insights — Project Intelligence Context data loader
 *
 * Loads enriched project data for the AI Insights context:
 * KPIs, FSPs, Diagnosis, RATE FAUS and Diary of Board.
 *
 * This module is the foundation of the Project Intelligence Context.
 * Designed to be extended in future phases (I-C2, I-C3).
 *
 * Security:
 *   - All queries are scoped to the validated project_id
 *   - No PII is included (no responsible names, emails, or user UUIDs)
 *   - No cross-project data can leak
 */

import { createClient } from '@/lib/supabase/server'
import type {
  DiagnosisStatus,
  FspMethodType,
  FspSourceType,
  FspStatus,
  KpiOriginType,
  KpiReadingType,
  KpiStatus,
  KpiTrend,
  PerformanceStatus,
  RateProfileType,
} from '@/types/database.types'

// ── Limits ────────────────────────────────────────────────────────────────────

const KPI_LIMIT = 15
const FSP_LIMIT = 10
const DIARY_ENTRY_LIMIT = 15
const DIARY_DELIVERABLE_LIMIT_PER_ENTRY = 5

// ── Public types ──────────────────────────────────────────────────────────────

export interface AiKpi {
  id: string
  kpi_name: string
  unit_of_measure: string | null
  status: KpiStatus
  trend: KpiTrend | null
  reading_type: KpiReadingType
  origin_type: KpiOriginType
  target_value: number | null
  current_value: number | null
}

export interface AiKpiTarget {
  id: string
  kpi_id: string
  period_label: string
  start_date: string
  end_date: string
  planned_target: number
}

export interface AiKpiRecord {
  kpi_id: string
  target_period_id: string | null
  competence: string
  actual_value: number
  calculated_status: PerformanceStatus
  justification: string | null
  short_analysis: string | null
  recorded_at: string
}

export interface AiFsp {
  id: string
  title: string
  source_type: FspSourceType
  kpi_id: string | null
  action_id: string | null
  linked_action_id: string | null
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

export interface AiDiagnosis {
  id: string
  start_date: string | null
  end_date: string | null
  executive_summary: string | null
  key_findings: string | null
  initial_hypotheses: string | null
  status: DiagnosisStatus
}

export interface AiRateVersion {
  id: string
  version_number: number
  version_name: string
  assessment_date: string
  profile_type: RateProfileType
  overall_score: number | null
}

export interface AiRateItem {
  version_id: string
  axis: string
  criterion: string
  weight: number
  score: number | null
}

export interface AiDiaryEntry {
  id: string
  title: string
  start_date: string
  end_date: string
}

export interface AiDiaryDeliverable {
  diary_entry_id: string
  description: string
  position: number
  status: string | null
  completion_date: string | null
  is_carried_over: boolean
}

/** Aggregated Project Intelligence Context data for AI Insights. */
export interface AiInsightsData {
  /** KPIs for the project, prioritized by red/yellow records, limited to KPI_LIMIT. */
  kpis: AiKpi[]
  /** KPI target periods overlapping the analysis period for the selected KPIs. */
  kpiTargets: AiKpiTarget[]
  /** Most recent KPI record per selected KPI within the analysis period. */
  kpiRecords: AiKpiRecord[]
  /** FSPs relevant to the period (open or opened/closed within it), limited to FSP_LIMIT. */
  fsps: AiFsp[]
  /** Most recent project diagnosis, or null if none exists. */
  diagnosis: AiDiagnosis | null
  /** Latest RATE assessment version, or null if none exists. */
  rateVersion: AiRateVersion | null
  /** All scored RATE items from the latest version. */
  rateItems: AiRateItem[]
  /** Diary entries overlapping the analysis period, most recent first. */
  diaryEntries: AiDiaryEntry[]
  /** Deliverables for the diary entries, limited per entry. */
  diaryDeliverables: AiDiaryDeliverable[]
}

// ── Loader ────────────────────────────────────────────────────────────────────

/**
 * Loads the enriched Project Intelligence Context for AI Insights.
 *
 * @param projectId - The validated project UUID (ownership already verified by the route).
 * @param startDate - ISO date string (YYYY-MM-DD) for the analysis period start.
 * @param endDate   - ISO date string (YYYY-MM-DD) for the analysis period end.
 */
export async function loadAiInsightsData(
  projectId: string,
  startDate: string,
  endDate: string
): Promise<AiInsightsData> {
  const supabase = await createClient()

  // ── Wave 1: top-level collections (parallel) ──────────────────────────────
  const [allKpisRes, allFspsRes, diagnosisRes, diaryEntriesRes] = await Promise.all([
    supabase
      .from('kpis')
      .select('id, kpi_name, unit_of_measure, status, trend, reading_type, origin_type, target_value, current_value')
      .eq('project_id', projectId)
      .order('kpi_name'),

    supabase
      .from('fsps')
      .select('id, title, source_type, kpi_id, action_id, linked_action_id, problem_statement, impact, method_type, root_cause, probable_cause, recommendation, status, opened_at, closed_at')
      .eq('project_id', projectId)
      .order('opened_at', { ascending: false }),

    supabase
      .from('project_diagnoses')
      .select('id, start_date, end_date, executive_summary, key_findings, initial_hypotheses, status')
      .eq('project_id', projectId)
      .maybeSingle(),

    supabase
      .from('diary_entries')
      .select('id, title, start_date, end_date')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .lte('start_date', endDate)
      .gte('end_date', startDate)
      .order('start_date', { ascending: false })
      .limit(DIARY_ENTRY_LIMIT),
  ])

  const allKpis = (allKpisRes.data as AiKpi[] | null) ?? []
  const allFsps = (allFspsRes.data as AiFsp[] | null) ?? []
  const diagnosis = (diagnosisRes.data as AiDiagnosis | null) ?? null
  const diaryEntries = (diaryEntriesRes.data as AiDiaryEntry[] | null) ?? []

  const allKpiIds = allKpis.map(kpi => kpi.id)
  const diaryEntryIds = diaryEntries.map(entry => entry.id)

  // ── Wave 2: dependent data using IDs from wave 1 (parallel) ──────────────
  const [allTargetsRes, allRecordsRes, rateAssessmentRes, deliverablesRes] = await Promise.all([
    allKpiIds.length > 0
      ? supabase
          .from('kpi_target_periods')
          .select('id, kpi_id, period_label, start_date, end_date, planned_target')
          .in('kpi_id', allKpiIds)
          .lte('start_date', endDate)
          .gte('end_date', startDate)
          .order('start_date', { ascending: true })
      : Promise.resolve({ data: [] as AiKpiTarget[] | null }),

    allKpiIds.length > 0
      ? supabase
          .from('kpi_period_records')
          .select('kpi_id, target_period_id, competence, actual_value, calculated_status, justification, short_analysis, recorded_at')
          .in('kpi_id', allKpiIds)
          .gte('recorded_at', startDate)
          .lte('recorded_at', `${endDate}T23:59:59.999Z`)
          .order('recorded_at', { ascending: false })
      : Promise.resolve({ data: [] as AiKpiRecord[] | null }),

    diagnosis
      ? supabase
          .from('rate_assessments')
          .select('id')
          .eq('diagnosis_id', diagnosis.id)
          .maybeSingle()
      : Promise.resolve({ data: null as { id: string } | null }),

    diaryEntryIds.length > 0
      ? supabase
          .from('diary_deliverables')
          .select('diary_entry_id, description, position, status, completion_date, is_carried_over')
          .in('diary_entry_id', diaryEntryIds)
          .order('position', { ascending: true })
      : Promise.resolve({ data: [] as AiDiaryDeliverable[] | null }),
  ])

  const allKpiTargets = (allTargetsRes.data as AiKpiTarget[] | null) ?? []
  const allKpiRecords = (allRecordsRes.data as AiKpiRecord[] | null) ?? []
  const rateAssessment = (rateAssessmentRes.data as { id: string } | null) ?? null
  const allDeliverables = (deliverablesRes.data as AiDiaryDeliverable[] | null) ?? []

  // ── KPI prioritization: red records first, then yellow, then alphabetical ─
  const recordsByKpi = groupByKey(allKpiRecords, r => r.kpi_id)
  const kpis = [...allKpis]
    .sort((a, b) => {
      const aRed = (recordsByKpi.get(a.id) ?? []).some(r => r.calculated_status === 'red')
      const bRed = (recordsByKpi.get(b.id) ?? []).some(r => r.calculated_status === 'red')
      if (aRed !== bRed) return aRed ? -1 : 1
      const aYellow = (recordsByKpi.get(a.id) ?? []).some(r => r.calculated_status === 'yellow')
      const bYellow = (recordsByKpi.get(b.id) ?? []).some(r => r.calculated_status === 'yellow')
      if (aYellow !== bYellow) return aYellow ? -1 : 1
      return a.kpi_name.localeCompare(b.kpi_name, 'pt-BR')
    })
    .slice(0, KPI_LIMIT)

  const selectedKpiIds = new Set(kpis.map(k => k.id))

  // Filter targets and records to selected KPIs; keep one record per KPI (most recent)
  const kpiTargets = allKpiTargets.filter(t => selectedKpiIds.has(t.kpi_id))
  const kpiRecords = deduplicateByKey(
    allKpiRecords.filter(r => selectedKpiIds.has(r.kpi_id)),
    r => r.kpi_id
  )

  // ── FSP filtering: open/in-analysis or opened/closed within the period ────
  const OPEN_FSP_STATUSES = new Set(['aberta', 'em_analise'])
  const fsps = [...allFsps]
    .filter(fsp =>
      OPEN_FSP_STATUSES.has(fsp.status) ||
      withinPeriod(fsp.opened_at, startDate, endDate) ||
      withinPeriod(fsp.closed_at, startDate, endDate)
    )
    .sort((a, b) => {
      const aOpen = OPEN_FSP_STATUSES.has(a.status)
      const bOpen = OPEN_FSP_STATUSES.has(b.status)
      if (aOpen !== bOpen) return aOpen ? -1 : 1
      return String(b.opened_at).localeCompare(String(a.opened_at))
    })
    .slice(0, FSP_LIMIT)

  // ── Rate: latest version only, then all scored items ─────────────────────
  let rateVersion: AiRateVersion | null = null
  let rateItems: AiRateItem[] = []

  if (rateAssessment) {
    const versionRes = await supabase
      .from('rate_assessment_versions')
      .select('id, version_number, version_name, assessment_date, profile_type, overall_score')
      .eq('assessment_id', rateAssessment.id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    rateVersion = (versionRes.data as AiRateVersion | null) ?? null

    if (rateVersion) {
      const itemsRes = await supabase
        .from('rate_assessment_items')
        .select('version_id, axis, criterion, weight, score')
        .eq('version_id', rateVersion.id)

      rateItems = (itemsRes.data as AiRateItem[] | null) ?? []
    }
  }

  // ── Limit deliverables per diary entry ────────────────────────────────────
  const diaryDeliverables = limitPerGroup(
    allDeliverables,
    d => d.diary_entry_id,
    DIARY_DELIVERABLE_LIMIT_PER_ENTRY
  )

  return {
    kpis,
    kpiTargets,
    kpiRecords,
    fsps,
    diagnosis,
    rateVersion,
    rateItems,
    diaryEntries,
    diaryDeliverables,
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

function withinPeriod(date: string | null | undefined, start: string, end: string): boolean {
  if (!date) return false
  const d = date.slice(0, 10)
  return d >= start && d <= end
}

function groupByKey<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = getKey(item)
    const group = map.get(key) ?? []
    group.push(item)
    map.set(key, group)
  }
  return map
}

/** Returns the first item per key (keeps first occurrence; input must be pre-sorted desc). */
function deduplicateByKey<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    const key = getKey(item)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
  }
  return result
}

/** Returns items with at most `limit` entries per group key. */
function limitPerGroup<T>(items: T[], getKey: (item: T) => string, limit: number): T[] {
  const counts = new Map<string, number>()
  const result: T[] = []
  for (const item of items) {
    const key = getKey(item)
    const count = counts.get(key) ?? 0
    if (count < limit) {
      result.push(item)
      counts.set(key, count + 1)
    }
  }
  return result
}
