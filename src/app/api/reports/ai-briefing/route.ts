import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import {
  loadReportData,
  normalizeReportPeriod,
  validateReportProjectAccess,
} from '@/lib/reports'
import {
  CONSULTANT_COMMENT_MAX_LENGTH,
  formatReportDate,
  formatReportDateTime,
  getActionStats,
  getActionStatusLabel,
  getActionsCompletedInPeriod,
  getMeetingTypeLabel,
  isReportActionOverdue,
  isWithinPeriod,
  limitItems,
  sanitizeConsultantComment,
} from '@/components/reports/pdf/utils'
import {
  DIAGNOSIS_STATUS_LABELS,
  FSP_METHOD_TYPE_LABELS,
  FSP_SOURCE_TYPE_LABELS,
  FSP_STATUS_LABELS,
  KPI_ORIGIN_TYPE_LABELS,
  KPI_READING_TYPE_LABELS,
  KPI_STATUS_LABELS,
  KPI_TREND_LABELS,
  PERFORMANCE_STATUS_LABELS,
} from '@/lib/utils'
import { calculateRateAxisScores, formatRateScore, RATE_PROFILE_LABELS } from '@/lib/rate-faus'
import type { ReportAction, ReportData, ReportMeeting } from '@/components/reports/pdf/types'
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

export const runtime = 'nodejs'

interface BriefingPayload {
  projectId?: unknown
  startDate?: unknown
  endDate?: unknown
  consultantComment?: unknown
}

interface BriefingKpiRow {
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

interface BriefingKpiTargetRow {
  id: string
  kpi_id: string
  period_label: string
  start_date: string
  end_date: string
  planned_target: number
}

interface BriefingKpiRecordRow {
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

interface BriefingFspRow {
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

interface BriefingDiagnosisRow {
  id: string
  start_date: string | null
  end_date: string | null
  executive_summary: string | null
  key_findings: string | null
  initial_hypotheses: string | null
  status: DiagnosisStatus
}

interface BriefingRateAssessmentRow {
  id: string
}

interface BriefingRateVersionRow {
  id: string
  version_number: number
  version_name: string
  assessment_date: string
  profile_type: RateProfileType
  overall_score: number | null
}

interface BriefingRateItemRow {
  version_id: string
  axis: string
  criterion: string
  weight: number
  score: number | null
}

interface BriefingDiaryEntryRow {
  id: string
  title: string
  start_date: string
  end_date: string
  faus_people: string[]
}

interface BriefingDiaryDeliverableRow {
  diary_entry_id: string
  description: string
  position: number
}

interface ConsultingBriefingData {
  kpis: BriefingKpiRow[]
  kpiTargets: BriefingKpiTargetRow[]
  kpiRecords: BriefingKpiRecordRow[]
  fsps: BriefingFspRow[]
  diagnosis: BriefingDiagnosisRow | null
  rateVersions: BriefingRateVersionRow[]
  rateItems: BriefingRateItemRow[]
  diaryEntries: BriefingDiaryEntryRow[]
  diaryDeliverables: BriefingDiaryDeliverableRow[]
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as BriefingPayload
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 })
  }
  if (session.status === 'no_profile' || session.status === 'inactive') {
    return NextResponse.json({ error: 'Perfil sem acesso ao briefing.' }, { status: 403 })
  }
  if (session.profile.role !== 'admin_faus') {
    return NextResponse.json(
      { error: 'O Briefing para IA está disponível apenas para admin_faus nesta fase.' },
      { status: 403 }
    )
  }

  const projectId = typeof payload.projectId === 'string' ? payload.projectId : null
  if (!projectId) {
    return NextResponse.json({ error: 'Informe o projeto para gerar o briefing.' }, { status: 400 })
  }

  const accessibleProject = await validateReportProjectAccess(session.profile, projectId)
  if (!accessibleProject) {
    return NextResponse.json({ error: 'Projeto não encontrado ou sem permissão de acesso.' }, { status: 403 })
  }

  const normalizedPeriod = normalizeReportPeriod(
    typeof payload.startDate === 'string' ? payload.startDate : null,
    typeof payload.endDate === 'string' ? payload.endDate : null
  )
  const data = await loadReportData(projectId, normalizedPeriod.startDate, normalizedPeriod.endDate)

  if (!data) {
    return NextResponse.json({ error: 'Não foi possível carregar os dados do projeto.' }, { status: 404 })
  }

  const consultingData = await loadConsultingBriefingData(projectId, normalizedPeriod.startDate, normalizedPeriod.endDate)

  const briefing = buildAiBriefingMarkdown({
    data,
    consultingData,
    consultantComment: sanitizeConsultantComment(payload.consultantComment),
  })

  return NextResponse.json({ briefing })
}

function buildAiBriefingMarkdown({
  data,
  consultingData,
  consultantComment,
}: {
  data: ReportData
  consultingData: ConsultingBriefingData
  consultantComment: string | null
}) {
  const stats = getActionStats(data.actions)
  const completedActions = getActionsCompletedInPeriod(data.actions, data.period.startDate, data.period.endDate)
  const inProgressActions = data.actions.filter(action => !action.completion_date && action.status === 'in_progress')
  const overdueActions = data.actions.filter(action => isReportActionOverdue(action) || action.status === 'overdue')
  const periodMeetings = data.meetings.filter(meeting =>
    isWithinPeriod(meeting.meeting_date, data.period.startDate, data.period.endDate)
  )
  const nextSteps = data.actions
    .filter(action => !action.completion_date && action.status !== 'completed' && action.status !== 'cancelled')
    .sort(sortActionsByDueDate)

  return [
    '# Briefing para IA — MOVE REPORT',
    '',
    '## 1. Papel da IA',
    'Você atuará como consultor executivo sênior da FAUS Soluções Estratégicas, especialista em gestão de projetos, logística, supply chain, operações, indicadores e governança.',
    '',
    '## 2. Objetivo da análise',
    'Analisar os dados abaixo, extraídos do MOVE FLOW, e gerar uma versão mais aprofundada e executiva do relatório do projeto.',
    '',
    '## 3. Regras obrigatórias',
    '- Não invente números.',
    '- Não invente fatos.',
    '- Não crie reuniões, KPIs, riscos ou resultados que não estejam informados.',
    '- Quando houver ausência de dados, declare a limitação.',
    '- Use português do Brasil.',
    '- Use linguagem executiva, consultiva, objetiva e profissional.',
    '- Mantenha tom FAUS: técnico, direto, humano e orientado à execução.',
    '- Não use emojis.',
    '- Não use linguagem exageradamente comercial.',
    '- Não prometa resultados não comprovados.',
    '- Diferencie fatos, hipóteses e recomendações.',
    '- Quando fizer inferência, sinalize como inferência.',
    '',
    '## 4. Identidade visual FAUS',
    '- Base: preto, branco e cinzas.',
    '- Destaque principal: verde/turquesa neon #0AFAB9.',
    '- Destaque secundário: laranja #DB6100.',
    '- Estilo: corporativo, premium, limpo, moderno e consultivo.',
    '- Usar hierarquia visual clara.',
    '- Evitar excesso de cor.',
    '- Relatório deve ter aparência institucional FAUS.',
    '',
    '## 5. Dados do projeto',
    `Cliente: ${data.project.client_name ?? 'Cliente não informado'}`,
    `Projeto: ${data.project.project_name}`,
    `Período: ${formatReportDate(data.period.startDate)} a ${formatReportDate(data.period.endDate)}`,
    `Data de geração: ${formatReportDateTime(data.generatedAt)}`,
    '',
    '## 6. Comentário consultivo informado',
    consultantComment
      ? consultantComment.slice(0, CONSULTANT_COMMENT_MAX_LENGTH)
      : 'Não foi informado Comentário Consultivo pelo usuário.',
    '',
    '## 7. Resumo quantitativo das ações',
    `Total: ${stats.total}`,
    `Concluídas: ${stats.completed}`,
    `Em andamento: ${stats.inProgress}`,
    `Atrasadas: ${stats.overdue}`,
    `Percentual de conclusão, se disponível: ${stats.completionPercent}%`,
    '',
    '## 8. Ações concluídas',
    formatActionList(completedActions, 'Não há ações concluídas registradas no período para este item.'),
    '',
    '## 9. Ações em andamento',
    formatActionList(inProgressActions, 'Não há ações em andamento registradas para este item.'),
    '',
    '## 10. Ações atrasadas / pontos críticos',
    formatActionList(overdueActions, 'Não há ações atrasadas registradas para este item.'),
    '',
    '## 11. Reuniões do período',
    formatMeetingList(periodMeetings),
    '',
    '## 12. Próximos passos sugeridos a partir dos dados',
    formatActionList(nextSteps, 'Não há próximos passos derivados das ações registradas para este item.'),
    '',
    '## 13. KPIs e desempenho do período',
    formatKpiSection(consultingData),
    '',
    '## 14. FSPs e análises de causa relevantes',
    formatFspSection(consultingData),
    '',
    '## 15. Diagnóstico e Rate FAUS',
    formatDiagnosisRateSection(consultingData),
    '',
    '## 16. Diário de Bordo e entregas realizadas',
    formatDiarySection(consultingData),
    '',
    '## 17. Entregável solicitado à IA',
    'Solicite que a IA gere:',
    '',
    '1. Resumo executivo.',
    '2. Principais avanços.',
    '3. Pontos de atenção.',
    '4. Riscos e bloqueios.',
    '5. Recomendações consultivas.',
    '6. Próximos passos.',
    '7. Texto revisado para a seção “Análise Consultiva do Período”.',
    '8. Estrutura sugerida para PDF executivo.',
    '9. Roteiro sugerido para apresentação em PPTX.',
    '10. Sugestões de gráficos ou quadros visuais, sem inventar dados.',
    '',
    '## 18. Formato de resposta desejado',
    'A IA deve responder com estrutura clara, usando títulos e subtítulos.',
    'Quando sugerir PPTX, deve organizar por slides.',
    'Quando sugerir PDF, deve organizar por seções.',
    'Quando faltar dado, deve indicar limitação.',
  ].join('\n')
}

async function loadConsultingBriefingData(
  projectId: string,
  startDate: string,
  endDate: string
): Promise<ConsultingBriefingData> {
  const supabase = await createClient()

  const [kpisRes, fspsRes, diagnosisRes, diaryEntriesRes] = await Promise.all([
    supabase
      .from('kpis')
      .select('id, kpi_name, unit_of_measure, status, trend, reading_type, origin_type, target_value, current_value')
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

  const kpis = (kpisRes.data as BriefingKpiRow[] | null) ?? []
  const kpiIds = kpis.map(kpi => kpi.id)
  const fsps = ((fspsRes.data as BriefingFspRow[] | null) ?? []).filter(fsp =>
    isWithinPeriod(fsp.opened_at, startDate, endDate) ||
    isWithinPeriod(fsp.closed_at, startDate, endDate) ||
    fsp.status === 'aberta' ||
    fsp.status === 'em_analise'
  )
  const diagnosis = (diagnosisRes.data as BriefingDiagnosisRow | null) ?? null
  const diaryEntries = (diaryEntriesRes.data as BriefingDiaryEntryRow[] | null) ?? []
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
      : Promise.resolve({ data: [] as BriefingKpiTargetRow[] | null }),
    kpiIds.length > 0
      ? supabase
          .from('kpi_period_records')
          .select('id, kpi_id, target_period_id, competence, actual_value, calculated_status, justification, short_analysis, recorded_at')
          .in('kpi_id', kpiIds)
          .gte('recorded_at', startDate)
          .lte('recorded_at', `${endDate}T23:59:59.999Z`)
          .order('recorded_at', { ascending: false })
      : Promise.resolve({ data: [] as BriefingKpiRecordRow[] | null }),
    diagnosis
      ? supabase
          .from('rate_assessments')
          .select('id')
          .eq('diagnosis_id', diagnosis.id)
          .maybeSingle()
      : Promise.resolve({ data: null as BriefingRateAssessmentRow | null }),
    diaryEntryIds.length > 0
      ? supabase
          .from('diary_deliverables')
          .select('diary_entry_id, description, position')
          .in('diary_entry_id', diaryEntryIds)
          .order('position', { ascending: true })
      : Promise.resolve({ data: [] as BriefingDiaryDeliverableRow[] | null }),
  ])

  const kpiTargets = (targetsRes.data as BriefingKpiTargetRow[] | null) ?? []
  const kpiRecords = (recordsRes.data as BriefingKpiRecordRow[] | null) ?? []
  const rateAssessment = (rateAssessmentRes.data as BriefingRateAssessmentRow | null) ?? null
  const diaryDeliverables = (deliverablesRes.data as BriefingDiaryDeliverableRow[] | null) ?? []

  const versionsRes = rateAssessment
    ? await supabase
        .from('rate_assessment_versions')
        .select('id, version_number, version_name, assessment_date, profile_type, overall_score')
        .eq('assessment_id', rateAssessment.id)
        .order('version_number', { ascending: false })
    : { data: [] as BriefingRateVersionRow[] | null }

  const rateVersions = (versionsRes.data as BriefingRateVersionRow[] | null) ?? []
  const versionIds = rateVersions.map(version => version.id)
  const itemsRes = versionIds.length > 0
    ? await supabase
        .from('rate_assessment_items')
        .select('version_id, axis, criterion, weight, score')
        .in('version_id', versionIds)
    : { data: [] as BriefingRateItemRow[] | null }

  return {
    kpis,
    kpiTargets,
    kpiRecords,
    fsps,
    diagnosis,
    rateVersions,
    rateItems: (itemsRes.data as BriefingRateItemRow[] | null) ?? [],
    diaryEntries,
    diaryDeliverables,
  }
}

function formatKpiSection(consultingData: ConsultingBriefingData) {
  const { kpis, kpiTargets, kpiRecords } = consultingData

  if (kpis.length === 0) {
    return 'Não há KPIs registrados para o projeto.'
  }

  const recordsByKpi = groupBy(kpiRecords, record => record.kpi_id)
  const targetsByKpi = groupBy(kpiTargets, target => target.kpi_id)
  const kpisWithRecords = kpis.filter(kpi => (recordsByKpi.get(kpi.id)?.length ?? 0) > 0).length
  const kpisOutOfTarget = kpis.filter(kpi =>
    (recordsByKpi.get(kpi.id) ?? []).some(record => record.calculated_status === 'red')
  ).length
  const kpisWithoutRecords = kpis.length - kpisWithRecords

  const rows = [
    `Total de KPIs do projeto: ${kpis.length}`,
    `KPIs com apuração no período: ${kpisWithRecords}`,
    `KPIs fora da meta no período, quando identificável: ${kpisOutOfTarget}`,
    `KPIs sem apuração no período: ${kpisWithoutRecords}`,
    '',
  ]

  const selectedKpis = limitItems(
    [...kpis].sort((left, right) => {
      const leftHasRed = (recordsByKpi.get(left.id) ?? []).some(record => record.calculated_status === 'red')
      const rightHasRed = (recordsByKpi.get(right.id) ?? []).some(record => record.calculated_status === 'red')
      if (leftHasRed !== rightHasRed) return leftHasRed ? -1 : 1
      return left.kpi_name.localeCompare(right.kpi_name)
    }),
    10
  )

  selectedKpis.forEach(kpi => {
    const records = recordsByKpi.get(kpi.id) ?? []
    const targets = targetsByKpi.get(kpi.id) ?? []
    const latestRecord = records[0] ?? null
    const applicableTarget = latestRecord
      ? targets.find(target => target.id === latestRecord.target_period_id) ?? targets[0] ?? null
      : targets[0] ?? null
    const unit = kpi.unit_of_measure ?? 'sem unidade informada'

    rows.push(`- KPI: ${kpi.kpi_name}`)
    rows.push(`  - Unidade de medida: ${unit}`)
    rows.push(`  - Status atual: ${KPI_STATUS_LABELS[kpi.status] ?? kpi.status}`)
    rows.push(`  - Tendência: ${kpi.trend ? KPI_TREND_LABELS[kpi.trend] ?? kpi.trend : 'Sem tendência registrada'}`)
    rows.push(`  - Leitura: ${KPI_READING_TYPE_LABELS[kpi.reading_type] ?? kpi.reading_type}`)
    rows.push(`  - Origem: ${KPI_ORIGIN_TYPE_LABELS[kpi.origin_type] ?? kpi.origin_type}`)
    rows.push(`  - Meta aplicável ao período: ${applicableTarget ? formatNumber(applicableTarget.planned_target, unit) : 'Não há meta registrada para o período.'}`)
    rows.push(`  - Valor apurado no período: ${latestRecord ? formatNumber(latestRecord.actual_value, unit) : 'Não há apuração registrada no período.'}`)
    rows.push(`  - Farol da apuração: ${latestRecord ? PERFORMANCE_STATUS_LABELS[latestRecord.calculated_status] ?? latestRecord.calculated_status : 'Sem farol no período'}`)
    if (latestRecord?.justification) rows.push(`  - Justificativa: ${latestRecord.justification}`)
    if (latestRecord?.short_analysis) rows.push(`  - Análise curta: ${latestRecord.short_analysis}`)
    if (!latestRecord && targets.length === 0) {
      rows.push('  - Limitação: Não há metas ou apurações registradas no período para este KPI.')
    }
  })

  if (kpis.length > selectedKpis.length) {
    rows.push(`- Há mais ${kpis.length - selectedKpis.length} KPI(s) disponível(is) no MOVE FLOW para este projeto.`)
  }

  return rows.join('\n')
}

function formatFspSection(consultingData: ConsultingBriefingData) {
  const { fsps, kpis } = consultingData

  if (fsps.length === 0) {
    return 'Não há FSPs registradas ou relevantes no período.'
  }

  const kpiMap = new Map(kpis.map(kpi => [kpi.id, kpi.kpi_name]))
  const selectedFsps = limitItems(
    [...fsps].sort((left, right) => {
      const leftOpen = left.status === 'aberta' || left.status === 'em_analise'
      const rightOpen = right.status === 'aberta' || right.status === 'em_analise'
      if (leftOpen !== rightOpen) return leftOpen ? -1 : 1
      return String(right.opened_at).localeCompare(String(left.opened_at))
    }),
    10
  )

  const rows = [
    `FSPs relevantes consideradas: ${fsps.length}`,
    '',
  ]

  selectedFsps.forEach(fsp => {
    const actionLink = fsp.action_id || fsp.linked_action_id || fsp.generated_action_id
      ? 'Com vínculo real com ação'
      : 'Sem vínculo com ação registrado'
    const kpiLink = fsp.kpi_id
      ? `KPI vinculado: ${kpiMap.get(fsp.kpi_id) ?? 'KPI vinculado no banco'}`
      : 'Sem KPI vinculado'

    rows.push(`- FSP: ${fsp.title}`)
    rows.push(`  - Status: ${FSP_STATUS_LABELS[fsp.status] ?? fsp.status}`)
    rows.push(`  - Origem: ${FSP_SOURCE_TYPE_LABELS[fsp.source_type] ?? fsp.source_type}`)
    rows.push(`  - Método utilizado: ${FSP_METHOD_TYPE_LABELS[fsp.method_type] ?? fsp.method_type}`)
    rows.push(`  - Abertura: ${formatReportDate(fsp.opened_at)}`)
    rows.push(`  - Conclusão: ${formatReportDate(fsp.closed_at)}`)
    rows.push(`  - Vínculo com KPI: ${kpiLink}`)
    rows.push(`  - Vínculo com ação: ${actionLink}`)
    rows.push(`  - Problema: ${fsp.problem_statement}`)
    rows.push(`  - Impacto: ${fsp.impact ?? 'Não informado.'}`)
    rows.push(`  - Causa raiz ou provável: ${fsp.root_cause ?? fsp.probable_cause ?? 'Não informada.'}`)
    rows.push(`  - Recomendação: ${fsp.recommendation ?? 'Não informada.'}`)
  })

  if (fsps.length > selectedFsps.length) {
    rows.push(`- Há mais ${fsps.length - selectedFsps.length} FSP(s) disponível(is) no MOVE FLOW para este projeto/período.`)
  }

  return rows.join('\n')
}

function formatDiagnosisRateSection(consultingData: ConsultingBriefingData) {
  const { diagnosis, rateVersions, rateItems } = consultingData

  if (!diagnosis && rateVersions.length === 0) {
    return 'Não há diagnóstico ou Rate FAUS salvo para este projeto/período.'
  }

  const rows: string[] = []

  if (diagnosis) {
    rows.push('- Diagnóstico')
    rows.push(`  - Status: ${DIAGNOSIS_STATUS_LABELS[diagnosis.status] ?? diagnosis.status}`)
    rows.push(`  - Período do diagnóstico: ${formatReportDate(diagnosis.start_date)} a ${formatReportDate(diagnosis.end_date)}`)
    rows.push(`  - Resumo executivo: ${diagnosis.executive_summary ?? 'Não informado.'}`)
    rows.push(`  - Principais achados: ${diagnosis.key_findings ?? 'Não informados.'}`)
    rows.push(`  - Hipóteses iniciais: ${diagnosis.initial_hypotheses ?? 'Não informadas.'}`)
  }

  const latestVersion = rateVersions[0] ?? null
  const previousVersion = rateVersions[1] ?? null

  if (!latestVersion) {
    rows.push('- Rate FAUS: Não há Rate FAUS salvo para este diagnóstico.')
    return rows.join('\n')
  }

  rows.push('- Último Rate FAUS salvo')
  rows.push(`  - Versão: ${latestVersion.version_number} - ${latestVersion.version_name}`)
  rows.push(`  - Perfil: ${RATE_PROFILE_LABELS[latestVersion.profile_type] ?? latestVersion.profile_type}`)
  rows.push(`  - Data de avaliação: ${formatReportDate(latestVersion.assessment_date)}`)
  rows.push(`  - Score geral: ${formatRateScore(latestVersion.overall_score)}`)

  if (previousVersion?.overall_score !== null && previousVersion?.overall_score !== undefined && latestVersion.overall_score !== null) {
    const variation = Number((latestVersion.overall_score - previousVersion.overall_score).toFixed(2))
    rows.push(`  - Evolução versus versão anterior: ${variation >= 0 ? '+' : ''}${formatRateScore(variation)}`)
  } else {
    rows.push('  - Evolução versus versão anterior: Não disponível.')
  }

  const latestItems = rateItems.filter(item => item.version_id === latestVersion.id)
  const criticalAxes = calculateRateAxisScores(latestItems)
    .filter(axis => axis.score !== null)
    .sort((left, right) => Number(left.score) - Number(right.score))
    .slice(0, 5)

  if (criticalAxes.length === 0) {
    rows.push('  - Eixos com menor score: Não há avaliações por eixo salvas.')
  } else {
    rows.push('  - Eixos com menor score:')
    criticalAxes.forEach(axis => {
      rows.push(`    - ${axis.axis}: ${formatRateScore(axis.score)} | preenchimento ${axis.completion}%`)
    })
  }

  return rows.join('\n')
}

function formatDiarySection(consultingData: ConsultingBriefingData) {
  const { diaryEntries, diaryDeliverables } = consultingData

  if (diaryEntries.length === 0) {
    return 'Não há registros de Diário de Bordo no período.'
  }

  const deliverablesByEntry = groupBy(diaryDeliverables, deliverable => deliverable.diary_entry_id)
  const totalDeliverables = diaryEntries.reduce(
    (sum, entry) => sum + (deliverablesByEntry.get(entry.id)?.length ?? 0),
    0
  )
  const selectedEntries = limitItems(diaryEntries, 10)
  const rows = [
    `Total de visitas/registros no período: ${diaryEntries.length}`,
    `Total de entregáveis no período: ${totalDeliverables}`,
    '',
  ]

  selectedEntries.forEach(entry => {
    const deliverables = limitItems(deliverablesByEntry.get(entry.id) ?? [], 5)
    rows.push(`- Registro: ${entry.title}`)
    rows.push(`  - Período: ${formatReportDate(entry.start_date)} a ${formatReportDate(entry.end_date)}`)
    rows.push(`  - Pessoas FAUS envolvidas: ${entry.faus_people.length ? entry.faus_people.join(', ') : 'Não informado.'}`)
    if (deliverables.length === 0) {
      rows.push('  - Entregáveis: Não há entregáveis registrados para este item.')
    } else {
      rows.push('  - Entregáveis:')
      deliverables.forEach(deliverable => {
        rows.push(`    - ${deliverable.description}`)
      })
      const totalEntryDeliverables = deliverablesByEntry.get(entry.id)?.length ?? 0
      if (totalEntryDeliverables > deliverables.length) {
        rows.push(`    - Há mais ${totalEntryDeliverables - deliverables.length} entregável(is) registrado(s) neste item.`)
      }
    }
  })

  if (diaryEntries.length > selectedEntries.length) {
    rows.push(`- Há mais ${diaryEntries.length - selectedEntries.length} registro(s) de Diário de Bordo no MOVE FLOW para este período.`)
  }

  return rows.join('\n')
}

function formatActionList(actions: ReportAction[], emptyMessage: string) {
  const selectedActions = limitItems(actions, 10)

  if (selectedActions.length === 0) {
    return emptyMessage
  }

  const rows = selectedActions.map(action => {
    const dueDate = action.due_date ? formatReportDate(action.due_date) : 'sem prazo informado'
    const completionDate = action.completion_date ? formatReportDate(action.completion_date) : 'sem conclusão informada'
    const responsible = action.responsible_name ?? 'responsável não informado'

    return `- ${action.title} | Status: ${getActionStatusLabel(action)} | Responsável: ${responsible} | Prazo: ${dueDate} | Conclusão: ${completionDate}`
  })

  if (actions.length > selectedActions.length) {
    rows.push(`- Há mais ${actions.length - selectedActions.length} ação(ões) disponível(is) no MOVE FLOW para este item.`)
  }

  return rows.join('\n')
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const grouped = new Map<string, T[]>()

  items.forEach(item => {
    const key = getKey(item)
    grouped.set(key, [...(grouped.get(key) ?? []), item])
  })

  return grouped
}

function formatNumber(value: number | null | undefined, unit?: string | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Não informado.'

  const formatted = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(value)

  return unit ? `${formatted} ${unit}` : formatted
}

function formatMeetingList(meetings: ReportMeeting[]) {
  const selectedMeetings = limitItems(meetings, 8)

  if (selectedMeetings.length === 0) {
    return 'Não há reuniões registradas no período para este item.'
  }

  const rows = selectedMeetings.map(meeting => {
    const participants = meeting.participants?.length
      ? meeting.participants.join(', ')
      : 'participantes não informados'
    const summary = meeting.executive_summary ?? 'sem resumo executivo informado'

    return `- ${formatReportDate(meeting.meeting_date)} | Tipo: ${getMeetingTypeLabel(meeting.meeting_type)} | Participantes: ${participants} | Resumo: ${summary}`
  })

  if (meetings.length > selectedMeetings.length) {
    rows.push(`- Há mais ${meetings.length - selectedMeetings.length} reunião(ões) disponível(is) no MOVE FLOW para este período.`)
  }

  return rows.join('\n')
}

function sortActionsByDueDate(a: ReportAction, b: ReportAction) {
  if (!a.due_date && !b.due_date) return a.title.localeCompare(b.title)
  if (!a.due_date) return 1
  if (!b.due_date) return -1
  if (a.due_date === b.due_date) return a.title.localeCompare(b.title)
  return a.due_date.localeCompare(b.due_date)
}
