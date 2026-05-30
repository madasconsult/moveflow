import { Document, Text, View } from '@react-pdf/renderer'
import { ConsultativeAnalysis, ReportCover, ReportPage, Section, EmptyState, MetricCard } from '@/components/reports/pdf/ReportLayout'
import { reportStyles } from '@/components/reports/pdf/ReportTheme'
import {
  formatReportDate,
  getActionStats,
  getActionStatusLabel,
  isReportActionOverdue,
  limitItems,
} from '@/components/reports/pdf/utils'
import type { ReportData } from '@/components/reports/pdf/types'

export function ExecutiveProjectReport({ data }: { data: ReportData }) {
  const stats = getActionStats(data.actions)
  const completedActions = data.actions.filter(action => action.status === 'completed' || action.completion_date)
  const inProgressActions = data.actions.filter(action => action.status === 'in_progress')
  const overdueActions = data.actions.filter(action => isReportActionOverdue(action) || action.status === 'overdue')
  const nextSteps = data.actions
    .filter(action => !action.completion_date && action.status !== 'completed' && action.status !== 'cancelled')
    .sort((left, right) => String(left.due_date ?? '9999-12-31').localeCompare(String(right.due_date ?? '9999-12-31')))

  return (
    <Document title="Relatório Executivo do Projeto">
      <ReportCover
        title="Relatório Executivo do Projeto"
        subtitle="Síntese executiva do projeto, carteira de ações e próximos passos."
        data={data}
      />
      <ReportPage title="Relatório Executivo do Projeto" data={data}>
        <Section title="Resumo do projeto">
          <Text style={reportStyles.paragraph}>
            {data.project.short_description || data.project.executive_scope || data.project.main_objective || 'Resumo executivo do projeto não informado.'}
          </Text>
        </Section>

        <ConsultativeAnalysis comment={data.consultantComment} />

        <View style={reportStyles.grid}>
          <MetricCard label="Total de ações" value={stats.total} />
          <MetricCard label="Concluídas" value={stats.completed} tone="success" />
          <MetricCard label="Em andamento" value={stats.inProgress} tone="warning" />
          <MetricCard label="Atrasadas" value={stats.overdue} tone="danger" />
        </View>
        <View style={reportStyles.grid}>
          <MetricCard label="Conclusão da carteira" value={`${stats.completionPercent}%`} tone="success" />
          <MetricCard label="Progresso do projeto" value={`${data.project.progress_percentage ?? 0}%`} tone="success" />
          <MetricCard label="Reuniões no período" value={data.meetings.length} />
          <MetricCard label="Status" value={data.project.status.replaceAll('_', ' ')} />
        </View>

        <ActionSummary title="Principais ações concluídas" actions={limitItems(completedActions)} />
        <ActionSummary title="Principais ações em andamento" actions={limitItems(inProgressActions)} />
        <ActionSummary title="Principais ações atrasadas" actions={limitItems(overdueActions)} />
        <ActionSummary title="Próximos passos" actions={limitItems(nextSteps)} />
      </ReportPage>
    </Document>
  )
}

function ActionSummary({ title, actions }: { title: string; actions: ReportData['actions'] }) {
  return (
    <Section title={title}>
      {actions.length === 0 ? (
        <EmptyState>Nenhum item disponível para esta seção.</EmptyState>
      ) : (
        <View style={reportStyles.table}>
          <View style={reportStyles.tableHeader}>
            <Text style={[reportStyles.tableHeaderCell, { width: '48%' }]}>Ação</Text>
            <Text style={[reportStyles.tableHeaderCell, { width: '18%' }]}>Status</Text>
            <Text style={[reportStyles.tableHeaderCell, { width: '17%' }]}>Responsável</Text>
            <Text style={[reportStyles.tableHeaderCell, { width: '17%' }]}>Prazo</Text>
          </View>
          {actions.map((action, index) => (
            <View key={action.id} style={[reportStyles.tableRow, index % 2 === 1 ? reportStyles.tableRowAlt : {}]}>
              <Text style={[reportStyles.tableCell, { width: '48%' }]}>{action.title}</Text>
              <View style={[reportStyles.tableCell, { width: '18%' }]}>
                <Text style={reportStyles.badge}>{getActionStatusLabel(action)}</Text>
              </View>
              <Text style={[reportStyles.tableCell, { width: '17%' }]}>{action.responsible_name ?? '—'}</Text>
              <Text style={[reportStyles.tableCell, { width: '17%' }]}>{formatReportDate(action.due_date)}</Text>
            </View>
          ))}
        </View>
      )}
    </Section>
  )
}
