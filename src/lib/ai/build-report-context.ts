/**
 * AI Insights — construção do contexto sanitizado (Project Intelligence Context)
 *
 * Recebe os dados já carregados pelo módulo de relatórios e constrói
 * uma representação textual segura para envio à IA.
 *
 * Dados pessoais NUNCA incluídos:
 *   - e-mails de usuários
 *   - UUIDs internos (id, assigned_to, user_id, responsible_id, owner_id)
 *   - responsible_name
 *   - faus_people
 *   - nomes de usuários individuais
 *   - tokens ou chaves de ambiente
 */

import {
  ACTION_STATUS_LABELS,
  ACTION_PRIORITY_LABELS,
  MEETING_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_PHASE_LABELS,
  KPI_STATUS_LABELS,
  KPI_TREND_LABELS,
  KPI_READING_TYPE_LABELS,
  PERFORMANCE_STATUS_LABELS,
  FSP_STATUS_LABELS,
  FSP_METHOD_TYPE_LABELS,
  FSP_SOURCE_TYPE_LABELS,
  DIAGNOSIS_STATUS_LABELS,
} from '@/lib/utils'
import {
  getActionStats,
  getActionsCompletedInPeriod,
  isReportActionOverdue,
  formatReportDate,
} from '@/components/reports/pdf/utils'
import type { ReportAction, ReportData, ReportMeeting } from '@/components/reports/pdf/types'
import type {
  AiInsightsData,
  AiKpi,
  AiKpiRecord,
  AiKpiTarget,
} from './load-insights-data'

const ACTION_LIMIT = 50
const MEETING_LIMIT = 20

// ── Generic helpers ───────────────────────────────────────────────────────────

/** Formata data ISO para dd/mm/aaaa sem timezone shift. */
function fmtDate(value: string | null | undefined): string {
  if (!value) return 'sem data'
  return formatReportDate(value)
}

/** Trunca texto longo com marcador. */
function truncate(text: string | null | undefined, maxLen: number): string {
  if (!text) return 'Não informado.'
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen)}[...]`
}

/** Formata número com locale pt-BR, com unidade opcional. */
function fmtNum(value: number | null | undefined, unit?: string | null): string {
  if (value === null || value === undefined) return 'sem valor'
  const formatted = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)
  return unit ? `${formatted} ${unit}` : formatted
}

/** Formata score do RATE (0–5). */
function fmtScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'sem nota'
  return `${score.toFixed(2)}/5,0`
}

// ── Action helpers ────────────────────────────────────────────────────────────

function actionStatusLabel(action: ReportAction): string {
  return ACTION_STATUS_LABELS[action.status] ?? action.status
}

function actionPriorityLabel(action: ReportAction): string {
  return (ACTION_PRIORITY_LABELS as Record<string, string>)[action.priority] ?? action.priority
}

function serializeActions(actions: ReportAction[], emptyMessage: string): string {
  if (actions.length === 0) return emptyMessage

  const slice = actions.slice(0, ACTION_LIMIT)
  const rows = slice.map(action => {
    const parts = [
      `- ${action.title}`,
      `  Status: ${actionStatusLabel(action)}`,
      `  Prioridade: ${actionPriorityLabel(action)}`,
    ]
    if (action.due_date) parts.push(`  Prazo: ${fmtDate(action.due_date)}`)
    if (action.completion_date) parts.push(`  Concluída em: ${fmtDate(action.completion_date)}`)
    return parts.join('\n')
  })

  if (actions.length > ACTION_LIMIT) {
    rows.push(`  (+ ${actions.length - ACTION_LIMIT} ação(ões) não listada(s) por limite de contexto)`)
  }

  return rows.join('\n')
}

// ── Meeting helpers ───────────────────────────────────────────────────────────

function serializeMeetings(meetings: ReportMeeting[], emptyMessage: string): string {
  if (meetings.length === 0) return emptyMessage

  const slice = meetings.slice(0, MEETING_LIMIT)
  const rows = slice.map(meeting => {
    const type = MEETING_TYPE_LABELS[meeting.meeting_type] ?? meeting.meeting_type
    const summary = meeting.executive_summary
      ? meeting.executive_summary.slice(0, 400)
      : 'Sem resumo executivo registrado.'
    return `- Data: ${fmtDate(meeting.meeting_date)} | Tipo: ${type}\n  Resumo: ${summary}`
  })

  if (meetings.length > MEETING_LIMIT) {
    rows.push(`  (+ ${meetings.length - MEETING_LIMIT} reunião(ões) não listada(s) por limite de contexto)`)
  }

  return rows.join('\n')
}

// ── KPI serializer ────────────────────────────────────────────────────────────

function serializeKpiSection(insightsData: AiInsightsData): string {
  const { kpis, kpiTargets, kpiRecords } = insightsData

  if (kpis.length === 0) {
    return 'Nenhum KPI cadastrado para este projeto.'
  }

  const recordByKpi = new Map<string, AiKpiRecord>(kpiRecords.map(r => [r.kpi_id, r]))
  const targetsByKpi = new Map<string, AiKpiTarget[]>()
  for (const t of kpiTargets) {
    const list = targetsByKpi.get(t.kpi_id) ?? []
    list.push(t)
    targetsByKpi.set(t.kpi_id, list)
  }

  const withRecord = kpis.filter(k => recordByKpi.has(k.id)).length
  const redCount = kpis.filter(k => recordByKpi.get(k.id)?.calculated_status === 'red').length
  const yellowCount = kpis.filter(k => recordByKpi.get(k.id)?.calculated_status === 'yellow').length

  const rows: string[] = [
    `KPIs cadastrados: ${kpis.length} | Com apuração no período: ${withRecord} | Fora da meta: ${redCount} | Em atenção: ${yellowCount} | Sem apuração: ${kpis.length - withRecord}`,
    '',
  ]

  for (const kpi of kpis) {
    const record = recordByKpi.get(kpi.id) ?? null
    const targets = targetsByKpi.get(kpi.id) ?? []
    const target = record
      ? targets.find(t => t.id === record.target_period_id) ?? targets[0] ?? null
      : targets[0] ?? null
    const unit = kpi.unit_of_measure ?? null

    rows.push(`- KPI: ${kpi.kpi_name}`)
    rows.push(`  Status atual: ${(KPI_STATUS_LABELS as Record<string, string>)[kpi.status] ?? kpi.status}`)
    if (kpi.trend) rows.push(`  Tendência: ${(KPI_TREND_LABELS as Record<string, string>)[kpi.trend] ?? kpi.trend}`)
    rows.push(`  Leitura: ${(KPI_READING_TYPE_LABELS as Record<string, string>)[kpi.reading_type] ?? kpi.reading_type}`)
    rows.push(`  Meta do período: ${target ? fmtNum(target.planned_target, unit) : 'Sem meta cadastrada no período'}`)

    if (record) {
      const farol = (PERFORMANCE_STATUS_LABELS as Record<string, string>)[record.calculated_status] ?? record.calculated_status
      rows.push(`  Apuração: ${fmtNum(record.actual_value, unit)} — ${farol} (competência: ${fmtDate(record.competence)})`)
      if (record.short_analysis) rows.push(`  Análise: ${truncate(record.short_analysis, 300)}`)
      if (record.justification) rows.push(`  Justificativa: ${truncate(record.justification, 300)}`)
    } else {
      rows.push('  Apuração: Sem apuração registrada no período.')
    }
  }

  return rows.join('\n')
}

// ── FSP serializer ────────────────────────────────────────────────────────────

function serializeFspSection(insightsData: AiInsightsData): string {
  const { fsps, kpis } = insightsData

  if (fsps.length === 0) {
    return 'Nenhuma FSP relevante no período.'
  }

  const kpiMap = new Map(kpis.map(k => [k.id, k.kpi_name]))
  const openCount = fsps.filter(f => f.status === 'aberta' || f.status === 'em_analise').length
  const rows: string[] = [
    `FSPs consideradas: ${fsps.length} | Abertas/em análise: ${openCount}`,
    '',
  ]

  for (const fsp of fsps) {
    const statusLabel = (FSP_STATUS_LABELS as Record<string, string>)[fsp.status] ?? fsp.status
    const methodLabel = (FSP_METHOD_TYPE_LABELS as Record<string, string>)[fsp.method_type] ?? fsp.method_type
    const sourceLabel = (FSP_SOURCE_TYPE_LABELS as Record<string, string>)[fsp.source_type] ?? fsp.source_type
    const linkedKpi = fsp.kpi_id ? (kpiMap.get(fsp.kpi_id) ?? 'KPI vinculado') : 'Nenhum'
    const hasActionLink = !!(fsp.action_id || fsp.linked_action_id)

    rows.push(`- FSP: ${fsp.title}`)
    rows.push(`  Status: ${statusLabel} | Método: ${methodLabel} | Origem: ${sourceLabel}`)
    rows.push(`  Abertura: ${fmtDate(fsp.opened_at)}${fsp.closed_at ? ` | Conclusão: ${fmtDate(fsp.closed_at)}` : ''}`)
    rows.push(`  KPI relacionado: ${linkedKpi}`)
    rows.push(`  Vínculo com ação: ${hasActionLink ? 'Sim' : 'Não'}`)
    rows.push(`  Problema: ${truncate(fsp.problem_statement, 400)}`)
    if (fsp.impact) rows.push(`  Impacto: ${truncate(fsp.impact, 200)}`)
    rows.push(`  Causa raiz/provável: ${truncate(fsp.root_cause ?? fsp.probable_cause, 300)}`)
    if (fsp.recommendation) rows.push(`  Recomendação: ${truncate(fsp.recommendation, 300)}`)
  }

  return rows.join('\n')
}

// ── Diagnosis serializer ──────────────────────────────────────────────────────

function serializeDiagnosisSection(insightsData: AiInsightsData): string {
  const { diagnosis } = insightsData

  if (!diagnosis) {
    return 'Nenhum diagnóstico registrado para este projeto.'
  }

  const statusLabel = (DIAGNOSIS_STATUS_LABELS as Record<string, string>)[diagnosis.status] ?? diagnosis.status
  const rows: string[] = [
    `Status: ${statusLabel}`,
    `Período do diagnóstico: ${fmtDate(diagnosis.start_date)} a ${fmtDate(diagnosis.end_date)}`,
    `Resumo executivo: ${truncate(diagnosis.executive_summary, 600)}`,
    `Principais achados: ${truncate(diagnosis.key_findings, 400)}`,
    `Hipóteses iniciais: ${truncate(diagnosis.initial_hypotheses, 400)}`,
  ]

  return rows.join('\n')
}

// ── RATE serializer ───────────────────────────────────────────────────────────

function serializeRateSection(insightsData: AiInsightsData): string {
  const { rateVersion, rateItems } = insightsData

  if (!rateVersion) {
    return 'Nenhum RATE FAUS registrado para este projeto.'
  }

  const rows: string[] = [
    `Versão: ${rateVersion.version_number} — ${rateVersion.version_name}`,
    `Perfil avaliado: ${rateVersion.profile_type}`,
    `Data de avaliação: ${fmtDate(rateVersion.assessment_date)}`,
    `Score geral: ${fmtScore(rateVersion.overall_score)}`,
    '',
  ]

  // Group items by axis and calculate average score per axis
  const axisGroups = new Map<string, number[]>()
  for (const item of rateItems) {
    if (item.score === null) continue
    const scores = axisGroups.get(item.axis) ?? []
    scores.push(item.score)
    axisGroups.set(item.axis, scores)
  }

  if (axisGroups.size === 0) {
    rows.push('Sem critérios avaliados nesta versão.')
    return rows.join('\n')
  }

  const axisScores = [...axisGroups.entries()]
    .map(([axis, scores]) => ({
      axis,
      avg: scores.reduce((s, v) => s + v, 0) / scores.length,
      count: scores.length,
    }))
    .sort((a, b) => a.avg - b.avg)

  rows.push(`Scores por eixo (${axisScores.length} eixos, ordenados do menor para o maior):`)
  for (const { axis, avg, count } of axisScores) {
    rows.push(`- ${axis}: ${fmtScore(avg)} (${count} critério(s))`)
  }

  return rows.join('\n')
}

// ── Diary serializer ──────────────────────────────────────────────────────────

function serializeDiarySection(insightsData: AiInsightsData): string {
  const { diaryEntries, diaryDeliverables } = insightsData

  if (diaryEntries.length === 0) {
    return 'Nenhum registro de Diário de Bordo no período.'
  }

  const deliverablesByEntry = new Map<string, typeof diaryDeliverables>()
  for (const d of diaryDeliverables) {
    const list = deliverablesByEntry.get(d.diary_entry_id) ?? []
    list.push(d)
    deliverablesByEntry.set(d.diary_entry_id, list)
  }

  const totalDeliverables = diaryDeliverables.length
  const carried = diaryDeliverables.filter(d => d.is_carried_over).length
  const rows: string[] = [
    `Visitas/registros no período: ${diaryEntries.length} | Entregáveis exibidos: ${totalDeliverables}${carried > 0 ? ` | Herdados de períodos anteriores: ${carried}` : ''}`,
    '',
  ]

  for (const entry of diaryEntries) {
    rows.push(`- Registro: ${entry.title}`)
    rows.push(`  Período: ${fmtDate(entry.start_date)} a ${fmtDate(entry.end_date)}`)

    const deliverables = deliverablesByEntry.get(entry.id) ?? []
    if (deliverables.length === 0) {
      rows.push('  Entregáveis: Nenhum entregável registrado.')
    } else {
      rows.push('  Entregáveis:')
      for (const d of deliverables) {
        const status = d.status ? ` (${d.status})` : ''
        const carryFlag = d.is_carried_over ? ' [herdado]' : ''
        rows.push(`    - ${d.description}${status}${carryFlag}`)
      }
    }
  }

  return rows.join('\n')
}

// ── Main context builder ──────────────────────────────────────────────────────

/**
 * Constrói o contexto sanitizado do projeto para envio à IA.
 *
 * Quando insightsData for fornecido, inclui KPIs, FSPs, Diagnóstico,
 * RATE FAUS e Diário de Bordo — formando o Project Intelligence Context.
 *
 * Retorna uma string markdown estruturada, sem dados pessoais.
 * O resultado é usado como user message na chamada à API.
 */
export function buildReportContext(
  data: ReportData,
  consultantComment?: string | null,
  insightsData?: AiInsightsData
): string {
  const stats = getActionStats(data.actions)
  const completedInPeriod = getActionsCompletedInPeriod(
    data.actions,
    data.period.startDate,
    data.period.endDate
  )
  const overdueActions = data.actions.filter(
    action => isReportActionOverdue(action) || action.status === 'overdue'
  )
  const inProgressActions = data.actions.filter(
    action => action.status === 'in_progress' && !action.completion_date
  )
  const openActions = data.actions.filter(
    action =>
      !action.completion_date &&
      action.status !== 'completed' &&
      action.status !== 'cancelled'
  )

  const statusLabel = PROJECT_STATUS_LABELS[data.project.status] ?? data.project.status
  const phaseLabel = PROJECT_PHASE_LABELS[data.project.phase] ?? data.project.phase

  // Running section counter — sections appear only when their data is present
  let sec = 0
  const s = () => `## ${++sec}.`

  const lines: string[] = [
    '# Contexto do projeto para análise consultiva',
    '',
    `${s()} Identificação`,
    `- Projeto: ${data.project.project_name}`,
    `- Cliente: ${data.project.client_name ?? 'Não informado'}`,
    `- Status: ${statusLabel}`,
    `- Fase: ${phaseLabel}`,
    `- Progresso: ${data.project.progress_percentage !== null ? `${data.project.progress_percentage}%` : 'Não informado'}`,
    '',
    `${s()} Período analisado`,
    `- Início: ${fmtDate(data.period.startDate)}`,
    `- Fim: ${fmtDate(data.period.endDate)}`,
    '',
  ]

  if (data.project.main_objective) {
    lines.push(`${s()} Objetivo principal`)
    lines.push(data.project.main_objective.slice(0, 800))
    lines.push('')
  }

  if (data.project.executive_scope) {
    lines.push(`${s()} Escopo executivo`)
    lines.push(data.project.executive_scope.slice(0, 800))
    lines.push('')
  }

  lines.push(`${s()} Resumo quantitativo das ações no período`)
  lines.push(`- Total de ações relevantes: ${stats.total}`)
  lines.push(`- Concluídas: ${stats.completed}`)
  lines.push(`- Em andamento: ${stats.inProgress}`)
  lines.push(`- Atrasadas: ${stats.overdue}`)
  lines.push(`- Percentual de conclusão: ${stats.completionPercent}%`)
  lines.push('')

  lines.push(`${s()} Ações concluídas no período`)
  lines.push(serializeActions(completedInPeriod, 'Nenhuma ação concluída no período.'))
  lines.push('')

  lines.push(`${s()} Ações em andamento`)
  lines.push(serializeActions(inProgressActions, 'Nenhuma ação em andamento registrada.'))
  lines.push('')

  lines.push(`${s()} Ações atrasadas`)
  lines.push(serializeActions(overdueActions, 'Nenhuma ação atrasada identificada.'))
  lines.push('')

  lines.push(`${s()} Próximos passos (ações abertas ordenadas por prazo)`)
  lines.push(serializeActions(openActions, 'Nenhuma ação aberta registrada.'))
  lines.push('')

  lines.push(`${s()} Reuniões no período`)
  lines.push(serializeMeetings(data.meetings, 'Nenhuma reunião registrada no período.'))
  lines.push('')

  // ── Extended modules (Project Intelligence Context) ───────────────────────
  if (insightsData) {
    lines.push(`${s()} KPIs e desempenho`)
    lines.push(serializeKpiSection(insightsData))
    lines.push('')

    lines.push(`${s()} FSPs e análise de causa`)
    lines.push(serializeFspSection(insightsData))
    lines.push('')

    lines.push(`${s()} Diagnóstico inicial do projeto`)
    lines.push(serializeDiagnosisSection(insightsData))
    lines.push('')

    lines.push(`${s()} RATE FAUS — maturidade operacional`)
    lines.push(serializeRateSection(insightsData))
    lines.push('')

    lines.push(`${s()} Diário de Bordo e entregáveis`)
    lines.push(serializeDiarySection(insightsData))
    lines.push('')
  }

  if (consultantComment) {
    lines.push(`${s()} Comentário consultivo do responsável`)
    lines.push(consultantComment.slice(0, 1800))
    lines.push('')
  }

  lines.push(`${s()} Instruções para a análise`)
  lines.push('Com base nos dados acima, gere os insights no formato JSON especificado.')
  lines.push('Identifique avanços, riscos, pontos de atenção e recomendações com base exclusivamente nos dados fornecidos.')
  if (insightsData) {
    lines.push('Cruze as informações entre módulos (ações, KPIs, FSPs, RATE, Diário) quando houver correlação relevante.')
    lines.push('Cite o módulo de origem de cada conclusão: "Com base nos KPIs...", "Conforme as FSPs abertas...", etc.')
  }
  lines.push('Declare limitações em data_limitations quando os dados forem insuficientes para conclusões confiáveis.')

  return lines.join('\n')
}
