import { Document, Text, View } from '@react-pdf/renderer'
import { ReportCover, ReportPage, Section, EmptyState } from '@/components/reports/pdf/ReportLayout'
import { reportStyles } from '@/components/reports/pdf/ReportTheme'
import {
  formatReportDate,
  formatReportDateTime,
  getActionStatusLabel,
  getActionsCompletedInPeriod,
  getActionsCreatedInPeriod,
  getActionsDueInPeriod,
  getMeetingTypeLabel,
  isReportActionOverdue,
  limitItems,
} from '@/components/reports/pdf/utils'
import type { ReportAction, ReportData, ReportMeeting } from '@/components/reports/pdf/types'

export function WeeklyProjectReport({ data }: { data: ReportData }) {
  const { startDate, endDate } = data.period
  const completed = getActionsCompletedInPeriod(data.actions, startDate, endDate)
  const created = getActionsCreatedInPeriod(data.actions, startDate, endDate)
  const due = getActionsDueInPeriod(data.actions, startDate, endDate)
  const overdue = due.filter(action => isReportActionOverdue(action) || action.status === 'overdue')
  const inProgress = data.actions.filter(action => action.status === 'in_progress')
  const meetings = data.meetings.filter(meeting => meeting.meeting_date.slice(0, 10) >= startDate && meeting.meeting_date.slice(0, 10) <= endDate)
  const nextSteps = data.actions
    .filter(action => !action.completion_date && action.status !== 'completed' && action.status !== 'cancelled')
    .sort((left, right) => String(left.due_date ?? '9999-12-31').localeCompare(String(right.due_date ?? '9999-12-31')))

  return (
    <Document title="Relatório Semanal">
      <ReportCover
        title="Relatório Semanal"
        subtitle="Leitura semanal de execução, reuniões, próximos passos e pontos de atenção."
        data={data}
      />
      <ReportPage title="Relatório Semanal" data={data}>
        <ActionList title="Ações concluídas no período" actions={completed} />
        <ActionList title="Ações criadas no período" actions={created} />
        <ActionList title="Ações vencidas no período" actions={overdue} />
        <ActionList title="Ações em andamento relevantes" actions={limitItems(inProgress)} />
        <MeetingList meetings={meetings} />
        <ActionList title="Próximos passos" actions={limitItems(nextSteps)} />
        <ActionList title="Pontos de atenção" actions={limitItems(overdue.length ? overdue : due)} />
      </ReportPage>
    </Document>
  )
}

function ActionList({ title, actions }: { title: string; actions: ReportAction[] }) {
  return (
    <Section title={title}>
      {actions.length === 0 ? (
        <EmptyState>Nenhum item registrado nesta seção.</EmptyState>
      ) : (
        <View style={reportStyles.table}>
          <View style={reportStyles.tableHeader}>
            <Text style={[reportStyles.tableHeaderCell, { width: '48%' }]}>Ação</Text>
            <Text style={[reportStyles.tableHeaderCell, { width: '18%' }]}>Status</Text>
            <Text style={[reportStyles.tableHeaderCell, { width: '17%' }]}>Responsável</Text>
            <Text style={[reportStyles.tableHeaderCell, { width: '17%' }]}>Prazo</Text>
          </View>
          {actions.slice(0, 10).map((action, index) => (
            <View key={action.id} style={[reportStyles.tableRow, index % 2 === 1 ? reportStyles.tableRowAlt : {}]}>
              <Text style={[reportStyles.tableCell, { width: '48%' }]}>{action.title}</Text>
              <View style={[reportStyles.tableCell, { width: '18%' }]}>
                <Text style={reportStyles.badge}>{getActionStatusLabel(action)}</Text>
              </View>
              <Text style={[reportStyles.tableCell, { width: '17%' }]}>{action.responsible_name ?? '—'}</Text>
              <Text style={[reportStyles.tableCell, { width: '17%' }]}>{formatReportDate(action.due_date)}</Text>
            </View>
          ))}
          {actions.length > 10 && (
            <Text style={reportStyles.moreNote}>
              Demais ações disponíveis no sistema MOVE FLOW. Esta seção apresenta os 10 itens principais para preservar legibilidade.
            </Text>
          )}
        </View>
      )}
    </Section>
  )
}

function MeetingList({ meetings }: { meetings: ReportMeeting[] }) {
  return (
    <Section title="Reuniões realizadas no período">
      {meetings.length === 0 ? (
        <EmptyState>Nenhuma reunião registrada no período.</EmptyState>
      ) : (
        <View style={reportStyles.table}>
          <View style={reportStyles.tableHeader}>
            <Text style={[reportStyles.tableHeaderCell, { width: '22%' }]}>Data</Text>
            <Text style={[reportStyles.tableHeaderCell, { width: '22%' }]}>Tipo</Text>
            <Text style={[reportStyles.tableHeaderCell, { width: '56%' }]}>Resumo</Text>
          </View>
          {meetings.slice(0, 10).map((meeting, index) => (
            <View key={meeting.id} style={[reportStyles.tableRow, index % 2 === 1 ? reportStyles.tableRowAlt : {}]}>
              <Text style={[reportStyles.tableCell, { width: '22%' }]}>{formatReportDateTime(meeting.meeting_date)}</Text>
              <Text style={[reportStyles.tableCell, { width: '22%' }]}>{getMeetingTypeLabel(meeting.meeting_type)}</Text>
              <Text style={[reportStyles.tableCell, { width: '56%' }]}>{meeting.executive_summary ?? 'Sem resumo registrado.'}</Text>
            </View>
          ))}
          {meetings.length > 10 && (
            <Text style={reportStyles.moreNote}>
              Demais reuniões disponíveis no sistema MOVE FLOW.
            </Text>
          )}
        </View>
      )}
    </Section>
  )
}
