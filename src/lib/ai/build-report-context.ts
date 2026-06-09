/**
 * AI Insights — construção do contexto sanitizado
 *
 * Recebe os dados já carregados pelo módulo de relatórios e constrói
 * uma representação textual segura para envio à IA.
 *
 * Dados pessoais NUNCA incluídos:
 *   - e-mails de usuários
 *   - UUIDs internos (id, assigned_to, user_id)
 *   - responsible_name
 *   - assigned_to
 *   - participants de reuniões
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
} from '@/lib/utils'
import {
  getActionStats,
  getActionsCompletedInPeriod,
  isReportActionOverdue,
  formatReportDate,
} from '@/components/reports/pdf/utils'
import type { ReportAction, ReportData, ReportMeeting } from '@/components/reports/pdf/types'

const ACTION_LIMIT = 50
const MEETING_LIMIT = 20

/** Formata data ISO para dd/mm/aaaa sem timezone shift. */
function fmtDate(value: string | null | undefined): string {
  if (!value) return 'sem data'
  return formatReportDate(value)
}

/** Retorna o label legível de status da ação. */
function actionStatusLabel(action: ReportAction): string {
  return ACTION_STATUS_LABELS[action.status] ?? action.status
}

/** Retorna o label legível de prioridade. */
function actionPriorityLabel(action: ReportAction): string {
  return (ACTION_PRIORITY_LABELS as Record<string, string>)[action.priority] ?? action.priority
}

/** Serializa lista de ações sem dados pessoais. */
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

/** Serializa lista de reuniões sem participantes. */
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

/**
 * Constrói o contexto sanitizado do relatório para envio à IA.
 *
 * Retorna uma string markdown estruturada, sem dados pessoais.
 * O resultado é usado como user message na chamada à API.
 */
export function buildReportContext(data: ReportData, consultantComment?: string | null): string {
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

  const lines: string[] = [
    '# Contexto do projeto para análise consultiva',
    '',
    '## 1. Identificação',
    `- Projeto: ${data.project.project_name}`,
    `- Cliente: ${data.project.client_name ?? 'Não informado'}`,
    `- Status: ${statusLabel}`,
    `- Fase: ${phaseLabel}`,
    `- Progresso: ${data.project.progress_percentage !== null ? `${data.project.progress_percentage}%` : 'Não informado'}`,
    '',
    '## 2. Período analisado',
    `- Início: ${fmtDate(data.period.startDate)}`,
    `- Fim: ${fmtDate(data.period.endDate)}`,
    '',
  ]

  if (data.project.main_objective) {
    lines.push('## 3. Objetivo principal')
    lines.push(data.project.main_objective.slice(0, 800))
    lines.push('')
  }

  if (data.project.executive_scope) {
    lines.push('## 4. Escopo executivo')
    lines.push(data.project.executive_scope.slice(0, 800))
    lines.push('')
  }

  lines.push('## 5. Resumo quantitativo das ações no período')
  lines.push(`- Total de ações relevantes no período: ${stats.total}`)
  lines.push(`- Concluídas: ${stats.completed}`)
  lines.push(`- Em andamento: ${stats.inProgress}`)
  lines.push(`- Atrasadas: ${stats.overdue}`)
  lines.push(`- Percentual de conclusão: ${stats.completionPercent}%`)
  lines.push('')

  lines.push('## 6. Ações concluídas no período')
  lines.push(serializeActions(completedInPeriod, 'Nenhuma ação concluída no período.'))
  lines.push('')

  lines.push('## 7. Ações em andamento')
  lines.push(serializeActions(inProgressActions, 'Nenhuma ação em andamento registrada.'))
  lines.push('')

  lines.push('## 8. Ações atrasadas')
  lines.push(serializeActions(overdueActions, 'Nenhuma ação atrasada identificada.'))
  lines.push('')

  lines.push('## 9. Próximos passos (ações abertas ordenadas por prazo)')
  lines.push(serializeActions(openActions, 'Nenhuma ação aberta registrada.'))
  lines.push('')

  lines.push('## 10. Reuniões no período')
  lines.push(serializeMeetings(data.meetings, 'Nenhuma reunião registrada no período.'))
  lines.push('')

  if (consultantComment) {
    lines.push('## 11. Comentário consultivo do responsável')
    lines.push(consultantComment.slice(0, 1800))
    lines.push('')
  }

  lines.push('## 12. Instruções para a análise')
  lines.push('Com base nos dados acima, gere os insights no formato JSON especificado.')
  lines.push('Identifique avanços, riscos, pontos de atenção e recomendações com base exclusivamente nos dados fornecidos.')
  lines.push('Declare limitações em data_limitations quando os dados forem insuficientes para conclusões confiáveis.')

  return lines.join('\n')
}
