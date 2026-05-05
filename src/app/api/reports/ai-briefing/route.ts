import { NextResponse } from 'next/server'
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
import type { ReportAction, ReportData, ReportMeeting } from '@/components/reports/pdf/types'

export const runtime = 'nodejs'

interface BriefingPayload {
  projectId?: unknown
  startDate?: unknown
  endDate?: unknown
  consultantComment?: unknown
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

  const briefing = buildAiBriefingMarkdown({
    data,
    consultantComment: sanitizeConsultantComment(payload.consultantComment),
  })

  return NextResponse.json({ briefing })
}

function buildAiBriefingMarkdown({
  data,
  consultantComment,
}: {
  data: ReportData
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
    '## 13. Entregável solicitado à IA',
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
    '## 14. Formato de resposta desejado',
    'A IA deve responder com estrutura clara, usando títulos e subtítulos.',
    'Quando sugerir PPTX, deve organizar por slides.',
    'Quando sugerir PDF, deve organizar por seções.',
    'Quando faltar dado, deve indicar limitação.',
  ].join('\n')
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
