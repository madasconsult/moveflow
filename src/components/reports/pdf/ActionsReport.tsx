import { Document, Text, View } from '@react-pdf/renderer'
import { ReportCover, ReportPage, Section, EmptyState, MetricCard } from '@/components/reports/pdf/ReportLayout'
import { reportStyles } from '@/components/reports/pdf/ReportTheme'
import {
  formatReportDate,
  getActionStats,
  getActionStatusLabel,
  getActionsByStatus,
  isReportActionOverdue,
} from '@/components/reports/pdf/utils'
import type { ReportData } from '@/components/reports/pdf/types'

export function ActionsReport({ data }: { data: ReportData }) {
  const stats = getActionStats(data.actions)
  const byStatus = Object.entries(getActionsByStatus(data.actions))
  const overdueActions = data.actions.filter(action => isReportActionOverdue(action))
  const upcomingActions = data.actions
    .filter(action => action.due_date && !action.completion_date && action.status !== 'completed')
    .sort((left, right) => String(left.due_date).localeCompare(String(right.due_date)))
    .slice(0, 10)

  return (
    <Document title="Relatório de Ações">
      <ReportCover
        title="Relatório de Ações"
        subtitle="Carteira de ações, prazos, responsáveis e pontos de atenção."
        data={data}
      />
      <ReportPage title="Relatório de Ações" data={data}>
        <View style={reportStyles.grid}>
          <MetricCard label="Total de ações" value={stats.total} />
          <MetricCard label="Concluídas" value={stats.completed} tone="success" />
          <MetricCard label="Em andamento" value={stats.inProgress} tone="warning" />
          <MetricCard label="Atrasadas" value={stats.overdue} tone="danger" />
        </View>

        <Section title="Ações por status">
          {byStatus.length === 0 ? (
            <EmptyState>Nenhuma ação registrada para este projeto.</EmptyState>
          ) : (
            <View style={reportStyles.table}>
              <View style={reportStyles.tableHeader}>
                <Text style={[reportStyles.tableHeaderCell, { width: '70%' }]}>Status</Text>
                <Text style={[reportStyles.tableHeaderCell, { width: '30%' }]}>Quantidade</Text>
              </View>
              {byStatus.map(([label, count]) => (
                <View key={label} style={reportStyles.tableRow}>
                  <Text style={[reportStyles.tableCell, { width: '70%' }]}>{label}</Text>
                  <Text style={[reportStyles.tableCell, { width: '30%' }]}>{count}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>

        <Section title="Ações vencidas">
          {overdueActions.length === 0 ? (
            <EmptyState>Nenhuma ação vencida em aberto no momento da geração.</EmptyState>
          ) : (
            <ActionTable data={overdueActions.slice(0, 10)} />
          )}
        </Section>

        <Section title="Próximas do vencimento">
          {upcomingActions.length === 0 ? (
            <EmptyState>Nenhuma ação futura com prazo registrado.</EmptyState>
          ) : (
            <ActionTable data={upcomingActions} />
          )}
        </Section>
      </ReportPage>

      <ReportPage title="Tabela detalhada de ações" data={data}>
        <Section title="Detalhamento">
          {data.actions.length === 0 ? (
            <EmptyState>Nenhuma ação registrada para o período/projeto selecionado.</EmptyState>
          ) : (
            <>
              <ActionTable data={data.actions.slice(0, 15)} detailed />
              {data.actions.length > 15 && (
                <Text style={reportStyles.moreNote}>
                  Demais ações disponíveis no sistema MOVE FLOW. Este relatório apresenta as 15 primeiras ações para preservar legibilidade.
                </Text>
              )}
            </>
          )}
        </Section>
      </ReportPage>
    </Document>
  )
}

function ActionTable({
  data,
  detailed = false,
}: {
  data: ReportData['actions']
  detailed?: boolean
}) {
  return (
    <View style={reportStyles.table}>
      <View style={reportStyles.tableHeader}>
        <Text style={[reportStyles.tableHeaderCell, { width: detailed ? '32%' : '45%' }]}>Ação</Text>
        <Text style={[reportStyles.tableHeaderCell, { width: '18%' }]}>Responsável</Text>
        <Text style={[reportStyles.tableHeaderCell, { width: '16%' }]}>Status</Text>
        <Text style={[reportStyles.tableHeaderCell, { width: '12%' }]}>Prazo</Text>
        <Text style={[reportStyles.tableHeaderCell, { width: '12%' }]}>Conclusão</Text>
        {detailed && <Text style={[reportStyles.tableHeaderCell, { width: '10%' }]}>ID</Text>}
      </View>
      {data.map((action, index) => (
        <View key={action.id} style={[reportStyles.tableRow, index % 2 === 1 ? reportStyles.tableRowAlt : {}]}>
          <Text style={[reportStyles.tableCell, { width: detailed ? '32%' : '45%' }]}>{action.title}</Text>
          <Text style={[reportStyles.tableCell, { width: '18%' }]}>{action.responsible_name ?? '—'}</Text>
          <View style={[reportStyles.tableCell, { width: '16%' }]}>
            <Text style={reportStyles.badge}>{getActionStatusLabel(action)}</Text>
          </View>
          <Text style={[reportStyles.tableCell, { width: '12%' }]}>{formatReportDate(action.due_date)}</Text>
          <Text style={[reportStyles.tableCell, { width: '12%' }]}>{formatReportDate(action.completion_date)}</Text>
          {detailed && <Text style={[reportStyles.tableCell, { width: '10%' }]}>{action.business_id ?? '—'}</Text>}
        </View>
      ))}
    </View>
  )
}
