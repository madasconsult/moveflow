import { Document, Text, View } from '@react-pdf/renderer'
import { ConsultativeAnalysis, ReportCover, ReportPage, Section, EmptyState, MetricCard } from '@/components/reports/pdf/ReportLayout'
import { reportColors, reportStyles } from '@/components/reports/pdf/ReportTheme'
import {
  formatReportDate,
  getActionVisualStatus,
  getActionVisualStatusLabel,
  getActionVisualStatusTone,
  isWithinPeriod,
  limitItems,
  safeReportBarWidth,
  safeReportNumber,
  safeReportPercent,
  safeReportScore,
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
import { calculateRateAxisScores, formatRateScore, RATE_PROFILE_LABELS, type RateAxisScore } from '@/lib/rate-faus'
import type { ReportConsultingData, ReportData, ReportFsp, ReportKpi } from '@/components/reports/pdf/types'

export function ExecutiveProjectReport({ data }: { data: ReportData }) {
  const referenceDate = data.period.endDate
  const stats = getExecutiveActionStats(data.actions, referenceDate)
  const completedActions = data.actions.filter(action => getActionVisualStatus(action, referenceDate) === 'completed')
  const inProgressActions = data.actions
    .filter(action => getActionVisualStatus(action, referenceDate) === 'in_progress')
    .sort(sortActionsByDueDate)
  const overdueActions = data.actions
    .filter(action => getActionVisualStatus(action, referenceDate) === 'overdue')
    .sort(sortActionsByDueDate)
  const nextSteps = data.actions
    .filter(action => getActionVisualStatus(action, referenceDate) === 'in_progress')
    .sort(sortActionsByDueDate)

  return (
    <Document title="Relatório Executivo do Projeto">
      <ReportCover
        title="Relatório Executivo do Projeto"
        subtitle="Síntese executiva do projeto, carteira de ações e próximos passos."
        data={data}
      />
      <ReportPage title="Relatório Executivo do Projeto" data={data}>
        <ProjectExecutivePanel data={data} stats={stats} />
        <ActionOverviewSection stats={stats} />
      </ReportPage>
      <ReportPage title="Relatório Executivo do Projeto" data={data}>
        <KpiExecutiveSection consulting={data.consulting} />
      </ReportPage>
      <ReportPage title="Relatório Executivo do Projeto" data={data}>
        <DiagnosisRateSection consulting={data.consulting} />
        <DiaryExecutiveSection consulting={data.consulting} />
      </ReportPage>
      <ReportPage title="Relatório Executivo do Projeto" data={data}>
        <FspExecutiveSection consulting={data.consulting} startDate={data.period.startDate} endDate={data.period.endDate} />
        <ConsultativeAnalysis comment={data.consultantComment} />
      </ReportPage>
      <ReportPage title="Relatório Executivo do Projeto" data={data}>
        <ActionSummary
          title="Principais ações concluídas"
          actions={limitItems(completedActions, 6)}
          referenceDate={referenceDate}
          hasMore={completedActions.length > 6}
        />
        <ActionSummary
          title="Principais ações em andamento"
          actions={limitItems(inProgressActions, 6)}
          referenceDate={referenceDate}
          hasMore={inProgressActions.length > 6}
        />
      </ReportPage>
      <ReportPage title="Relatório Executivo do Projeto" data={data}>
        <ActionSummary
          title="Principais ações atrasadas"
          actions={limitItems(overdueActions, 6)}
          referenceDate={referenceDate}
          hasMore={overdueActions.length > 6}
        />
        <ActionSummary
          title="Próximos passos"
          actions={limitItems(nextSteps, 6)}
          referenceDate={referenceDate}
          hasMore={nextSteps.length > 6}
          emptyMessage={overdueActions.length > 0
            ? 'Sem próximos passos não vencidos no período. Prioridade imediata: tratar as ações atrasadas listadas no bloco anterior.'
            : 'Nenhum próximo passo não vencido disponível para esta seção.'}
        />
      </ReportPage>
    </Document>
  )
}

interface ExecutiveActionStats {
  total: number
  completed: number
  inProgress: number
  overdue: number
  open: number
  other: number
  completionPercent: number
}

function ProjectExecutivePanel({ data, stats }: { data: ReportData; stats: ExecutiveActionStats }) {
  const consulting = data.consulting
  const totalKpis = consulting?.kpis.length ?? 0
  const diagnosisKpis = consulting?.kpis.filter(kpi => kpi.origin_type === 'diagnostic' || kpi.diagnosis_indicator_id).length ?? 0
  const otherKpis = Math.max(totalKpis - diagnosisKpis, 0)
  const latestRate = consulting?.rateVersions[0] ?? null
  const latestRateScore = safeReportScore(latestRate?.overall_score, 5)
  const projectSummary = data.project.short_description || data.project.executive_scope || data.project.main_objective || 'Resumo executivo do projeto não informado.'

  return (
    <Section title="Painel Executivo do Projeto">
      <View style={reportStyles.consultativeBox}>
        <Text style={reportStyles.consultativeKicker}>Leitura inicial</Text>
        <Text style={reportStyles.consultativeText}>{projectSummary}</Text>
      </View>

      <View style={reportStyles.grid}>
        <MetricCard label="Andamento por ações" value={`${stats.completionPercent}%`} tone="success" />
        <MetricCard label="Visitas no período" value={consulting?.diaryEntries.length ?? 'Sem dados'} />
        <MetricCard label="Ações abertas/total" value={`${stats.open}/${stats.total}`} tone="warning" />
      </View>
      <View style={reportStyles.grid}>
        <MetricCard label="Ações concluídas" value={stats.completed} tone="success" />
        <MetricCard label="Em andamento" value={stats.inProgress} tone="warning" />
        <MetricCard label="Atrasadas" value={stats.overdue} tone="danger" />
      </View>
      <View style={reportStyles.grid}>
        <MetricCard label="Último Rate FAUS" value={latestRate && latestRateScore !== null ? formatRateScore(latestRateScore) : 'Sem dados'} tone="success" />
        <MetricCard label="KPIs monitorados" value={totalKpis || 'Sem dados'} />
        <MetricCard label="KPIs diagnóstico/outras" value={totalKpis ? `${diagnosisKpis}/${otherKpis}` : 'Sem dados'} />
      </View>
    </Section>
  )
}

function ActionOverviewSection({ stats }: { stats: ExecutiveActionStats }) {
  const rows = [
    { label: 'Concluídas', value: stats.completed, color: reportColors.neon },
    { label: 'Em andamento', value: stats.inProgress, color: reportColors.orange },
    { label: 'Atrasadas', value: stats.overdue, color: reportColors.red },
    { label: 'Outras', value: stats.other, color: reportColors.muted },
  ]

  return (
    <Section title="Visão Geral de Ações">
      <DistributionBars
        title="Distribuição executiva da carteira"
        total={stats.total}
        rows={rows}
        emptyMessage="Não há ações registradas para este projeto."
      />
      <Text style={reportStyles.moreNote}>
        Status visual de atraso considera prazo anterior ao fim do período e ausência de conclusão, sem alterar o status gravado no banco.
      </Text>
    </Section>
  )
}

function KpiExecutiveSection({ consulting }: { consulting?: ReportConsultingData }) {
  if (!consulting || consulting.kpis.length === 0) {
    return (
      <Section title="Indicadores de Performance">
        <EmptyState>Não há KPIs registrados para este projeto.</EmptyState>
      </Section>
    )
  }

  const recordsByKpi = groupBy(consulting.kpiRecords, record => record.kpi_id)
  const targetsByKpi = groupBy(consulting.kpiTargets, target => target.kpi_id)
  const kpisWithRecords = consulting.kpis.filter(kpi => (recordsByKpi.get(kpi.id)?.length ?? 0) > 0).length
  const kpisOutOfTarget = consulting.kpis.filter(kpi =>
    (recordsByKpi.get(kpi.id) ?? []).some(record => record.calculated_status === 'red')
  ).length
  const kpisWithoutRecords = consulting.kpis.length - kpisWithRecords
  const statusDistribution = buildKpiStatusDistribution(consulting)
  const diagnosisKpis = consulting.kpis.filter(kpi => kpi.origin_type === 'diagnostic' || kpi.diagnosis_indicator_id).length
  const originDistribution = [
    { label: 'Origem diagnóstico', value: diagnosisKpis, color: reportColors.neon },
    { label: 'Outras origens', value: Math.max(consulting.kpis.length - diagnosisKpis, 0), color: reportColors.orange },
  ]
  const outOfTargetDistribution = [
    { label: 'Fora da meta', value: kpisOutOfTarget, color: reportColors.red },
    { label: 'Sem alerta vermelho', value: Math.max(consulting.kpis.length - kpisOutOfTarget, 0), color: reportColors.muted },
  ]
  const selectedKpis = limitItems(
    [...consulting.kpis].sort((left, right) => {
      const leftHasRed = hasRedRecord(left, recordsByKpi)
      const rightHasRed = hasRedRecord(right, recordsByKpi)
      if (leftHasRed !== rightHasRed) return leftHasRed ? -1 : 1
      return left.kpi_name.localeCompare(right.kpi_name)
    }),
    5
  )

  return (
    <Section title="Indicadores de Performance">
      <View style={reportStyles.grid}>
        <MetricCard label="KPIs do projeto" value={consulting.kpis.length} />
        <MetricCard label="Com apuração" value={kpisWithRecords} tone="success" />
        <MetricCard label="Fora da meta" value={kpisOutOfTarget} tone="danger" />
        <MetricCard label="Sem apuração" value={kpisWithoutRecords} tone="warning" />
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <DistributionBars
          title="Farol das apurações"
          total={consulting.kpis.length}
          rows={statusDistribution}
          emptyMessage="Não há KPIs para distribuir por farol."
        />
        <DistributionBars
          title="Origem dos KPIs"
          total={consulting.kpis.length}
          rows={originDistribution}
          emptyMessage="Não há KPIs para distribuir por origem."
        />
      </View>
      <DistributionBars
        title="KPIs fora da meta"
        total={consulting.kpis.length}
        rows={outOfTargetDistribution}
        emptyMessage="Não há dados suficientes para avaliar KPIs fora da meta."
      />

      {consulting.kpiRecords.length === 0 ? (
        <EmptyState>Não há apurações de KPI registradas no período selecionado.</EmptyState>
      ) : (
        <View style={reportStyles.table}>
          <View style={reportStyles.tableHeader}>
            <Text style={[reportStyles.tableHeaderCell, { width: '28%' }]}>KPI</Text>
            <Text style={[reportStyles.tableHeaderCell, { width: '16%' }]}>Farol</Text>
            <Text style={[reportStyles.tableHeaderCell, { width: '18%' }]}>Meta</Text>
            <Text style={[reportStyles.tableHeaderCell, { width: '18%' }]}>Realizado</Text>
            <Text style={[reportStyles.tableHeaderCell, { width: '20%' }]}>Leitura</Text>
          </View>
          {selectedKpis.map((kpi, index) => {
            const records = recordsByKpi.get(kpi.id) ?? []
            const targets = targetsByKpi.get(kpi.id) ?? []
            const latestRecord = records[0] ?? null
            const applicableTarget = latestRecord
              ? targets.find(target => target.id === latestRecord.target_period_id) ?? targets[0] ?? null
              : targets[0] ?? null
            const unit = kpi.unit_of_measure ?? null
            const analysis = latestRecord?.short_analysis || latestRecord?.justification || 'Sem análise curta registrada.'

            return (
              <View key={kpi.id} style={[reportStyles.tableRow, index % 2 === 1 ? reportStyles.tableRowAlt : {}]}>
                <View style={[reportStyles.tableCell, { width: '28%' }]}>
                  <Text>{kpi.kpi_name}</Text>
                  <Text style={reportStyles.moreNote}>
                    {KPI_STATUS_LABELS[kpi.status] ?? kpi.status} | {kpi.trend ? KPI_TREND_LABELS[kpi.trend] ?? kpi.trend : 'Sem tendência'}
                  </Text>
                  <Text style={reportStyles.moreNote}>
                    {KPI_READING_TYPE_LABELS[kpi.reading_type] ?? kpi.reading_type} | {KPI_ORIGIN_TYPE_LABELS[kpi.origin_type] ?? kpi.origin_type}
                  </Text>
                </View>
                <View style={[reportStyles.tableCell, { width: '16%' }]}>
                  <Text style={reportStyles.badge}>
                    {latestRecord ? PERFORMANCE_STATUS_LABELS[latestRecord.calculated_status] ?? latestRecord.calculated_status : 'Sem apuração'}
                  </Text>
                </View>
                <Text style={[reportStyles.tableCell, { width: '18%' }]}>
                  {applicableTarget ? formatNumber(applicableTarget.planned_target, unit) : '—'}
                </Text>
                <Text style={[reportStyles.tableCell, { width: '18%' }]}>
                  {latestRecord ? formatNumber(latestRecord.actual_value, unit) : '—'}
                </Text>
                <Text style={[reportStyles.tableCell, { width: '20%' }]}>{analysis}</Text>
              </View>
            )
          })}
        </View>
      )}

      {consulting.kpis.length > selectedKpis.length ? (
        <Text style={reportStyles.moreNote}>Demais KPIs disponíveis no MOVE FLOW.</Text>
      ) : null}
    </Section>
  )
}

function FspExecutiveSection({
  consulting,
  startDate,
  endDate,
}: {
  consulting?: ReportConsultingData
  startDate: string
  endDate: string
}) {
  if (!consulting || consulting.fsps.length === 0) {
    return (
      <Section title="FSPs e Pontos de Atenção">
        <EmptyState>Não há FSPs registradas ou relevantes no período.</EmptyState>
      </Section>
    )
  }

  const openedInPeriod = consulting.fsps.filter(fsp => isWithinPeriod(fsp.opened_at, startDate, endDate)).length
  const closedInPeriod = consulting.fsps.filter(fsp => isWithinPeriod(fsp.closed_at, startDate, endDate)).length
  const openRelevant = consulting.fsps.filter(fsp => fsp.status === 'aberta' || fsp.status === 'em_analise').length
  const kpiMap = new Map(consulting.kpis.map(kpi => [kpi.id, kpi.kpi_name]))
  const selectedFsps = limitItems(
    [...consulting.fsps].sort((left, right) => {
      const leftOpen = left.status === 'aberta' || left.status === 'em_analise'
      const rightOpen = right.status === 'aberta' || right.status === 'em_analise'
      if (leftOpen !== rightOpen) return leftOpen ? -1 : 1
      return String(right.opened_at).localeCompare(String(left.opened_at))
    }),
    5
  )

  return (
    <Section title="FSPs e Pontos de Atenção">
      <View style={reportStyles.grid}>
        <MetricCard label="FSPs relevantes" value={consulting.fsps.length} />
        <MetricCard label="Abertas no período" value={openedInPeriod} tone="warning" />
        <MetricCard label="Concluídas no período" value={closedInPeriod} tone="success" />
        <MetricCard label="Ainda abertas" value={openRelevant} tone="danger" />
      </View>

      <View style={reportStyles.table}>
        <View style={reportStyles.tableHeader}>
          <Text style={[reportStyles.tableHeaderCell, { width: '25%' }]}>FSP</Text>
          <Text style={[reportStyles.tableHeaderCell, { width: '15%' }]}>Status</Text>
          <Text style={[reportStyles.tableHeaderCell, { width: '22%' }]}>Problema</Text>
          <Text style={[reportStyles.tableHeaderCell, { width: '20%' }]}>Causa</Text>
          <Text style={[reportStyles.tableHeaderCell, { width: '18%' }]}>Recomendação</Text>
        </View>
        {selectedFsps.map((fsp, index) => (
          <View key={fsp.id} style={[reportStyles.tableRow, index % 2 === 1 ? reportStyles.tableRowAlt : {}]}>
            <View style={[reportStyles.tableCell, { width: '25%' }]}>
              <Text>{fsp.title}</Text>
              <Text style={reportStyles.moreNote}>{formatFspLinks(fsp, kpiMap)}</Text>
              <Text style={reportStyles.moreNote}>
                {FSP_SOURCE_TYPE_LABELS[fsp.source_type] ?? fsp.source_type} | {FSP_METHOD_TYPE_LABELS[fsp.method_type] ?? fsp.method_type}
              </Text>
            </View>
            <View style={[reportStyles.tableCell, { width: '15%' }]}>
              <Text style={reportStyles.badge}>{FSP_STATUS_LABELS[fsp.status] ?? fsp.status}</Text>
            </View>
            <Text style={[reportStyles.tableCell, { width: '22%' }]}>{fsp.problem_statement}</Text>
            <Text style={[reportStyles.tableCell, { width: '20%' }]}>{fsp.root_cause ?? fsp.probable_cause ?? 'Não informada.'}</Text>
            <Text style={[reportStyles.tableCell, { width: '18%' }]}>{fsp.recommendation ?? 'Não informada.'}</Text>
          </View>
        ))}
      </View>

      {consulting.fsps.length > selectedFsps.length ? (
        <Text style={reportStyles.moreNote}>Demais FSPs disponíveis no MOVE FLOW.</Text>
      ) : null}
    </Section>
  )
}

function DiagnosisRateSection({ consulting }: { consulting?: ReportConsultingData }) {
  if (!consulting || (!consulting.diagnosis && consulting.rateVersions.length === 0)) {
    return (
      <Section title="Diagnóstico e Rate FAUS">
        <EmptyState>Não há diagnóstico ou Rate FAUS salvo para este projeto.</EmptyState>
      </Section>
    )
  }

  const latestVersion = consulting.rateVersions[0] ?? null
  const previousVersion = consulting.rateVersions[1] ?? null
  const latestItems = latestVersion
    ? consulting.rateItems.filter(item => item.version_id === latestVersion.id)
    : []
  const criticalAxes = calculateRateAxisScores(latestItems)
    .filter(axis => safeReportScore(axis.score, 5) !== null)
    .sort((left, right) => safeReportNumber(safeReportScore(left.score, 5), 0) - safeReportNumber(safeReportScore(right.score, 5), 0))
    .slice(0, 5)

  return (
    <Section title="Diagnóstico e Rate FAUS">
      {consulting.diagnosis ? (
        <View style={reportStyles.consultativeBox}>
          <Text style={reportStyles.consultativeKicker}>
            Diagnóstico | {DIAGNOSIS_STATUS_LABELS[consulting.diagnosis.status] ?? consulting.diagnosis.status}
          </Text>
          <Text style={reportStyles.consultativeText}>
            {consulting.diagnosis.executive_summary ?? 'Resumo executivo do diagnóstico não informado.'}
          </Text>
          <Text style={reportStyles.moreNote}>
            Achados: {consulting.diagnosis.key_findings ?? 'Não informados.'}
          </Text>
          <Text style={reportStyles.moreNote}>
            Hipóteses: {consulting.diagnosis.initial_hypotheses ?? 'Não informadas.'}
          </Text>
        </View>
      ) : (
        <EmptyState>Não há diagnóstico salvo para este projeto.</EmptyState>
      )}

      {latestVersion ? (
        <>
          <RateScoreVisual
            score={latestVersion.overall_score}
            previousScore={previousVersion?.overall_score}
            criticalAxes={criticalAxes}
          />
          <View style={reportStyles.grid}>
            <MetricCard label="Última versão Rate" value={`V${latestVersion.version_number}`} />
            <MetricCard label="Score geral" value={formatRateScore(safeReportScore(latestVersion.overall_score, 5))} tone="success" />
            <MetricCard label="Data da avaliação" value={formatReportDate(latestVersion.assessment_date)} />
            <MetricCard label="Evolução" value={formatRateVariation(safeReportScore(latestVersion.overall_score, 5), safeReportScore(previousVersion?.overall_score, 5))} tone="warning" />
          </View>
          <Text style={reportStyles.moreNote}>
            {latestVersion.version_name} | Perfil: {RATE_PROFILE_LABELS[latestVersion.profile_type] ?? latestVersion.profile_type}
          </Text>

          {criticalAxes.length === 0 ? (
            <EmptyState>Não há avaliações por eixo salvas no último Rate FAUS.</EmptyState>
          ) : (
            <View style={reportStyles.table}>
              <View style={reportStyles.tableHeader}>
                <Text style={[reportStyles.tableHeaderCell, { width: '52%' }]}>Eixo crítico</Text>
                <Text style={[reportStyles.tableHeaderCell, { width: '24%' }]}>Score</Text>
                <Text style={[reportStyles.tableHeaderCell, { width: '24%' }]}>Preenchimento</Text>
              </View>
              {criticalAxes.map((axis, index) => (
                <View key={axis.axis} style={[reportStyles.tableRow, index % 2 === 1 ? reportStyles.tableRowAlt : {}]}>
                  <Text style={[reportStyles.tableCell, { width: '52%' }]}>{axis.axis}</Text>
                  <Text style={[reportStyles.tableCell, { width: '24%' }]}>{formatRateScore(safeReportScore(axis.score, 5))}</Text>
                  <Text style={[reportStyles.tableCell, { width: '24%' }]}>{axis.completion}%</Text>
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <EmptyState>Não há Rate FAUS salvo para este diagnóstico.</EmptyState>
      )}
    </Section>
  )
}

function DiaryExecutiveSection({ consulting }: { consulting?: ReportConsultingData }) {
  if (!consulting || consulting.diaryEntries.length === 0) {
    return (
      <Section title="Diário de Bordo e Entregas">
        <EmptyState>Não há registros de Diário de Bordo no período selecionado.</EmptyState>
      </Section>
    )
  }

  const deliverablesByEntry = groupBy(consulting.diaryDeliverables, deliverable => deliverable.diary_entry_id)
  const totalDeliverables = consulting.diaryEntries.reduce(
    (sum, entry) => sum + (deliverablesByEntry.get(entry.id)?.length ?? 0),
    0
  )
  const selectedEntries = limitItems(consulting.diaryEntries, 5)

  return (
    <Section title="Diário de Bordo e Entregas">
      <View style={reportStyles.grid}>
        <MetricCard label="Registros no período" value={consulting.diaryEntries.length} />
        <MetricCard label="Entregáveis" value={totalDeliverables} tone="success" />
      </View>

      <View style={reportStyles.table}>
        <View style={reportStyles.tableHeader}>
          <Text style={[reportStyles.tableHeaderCell, { width: '30%' }]}>Registro</Text>
          <Text style={[reportStyles.tableHeaderCell, { width: '18%' }]}>Período</Text>
          <Text style={[reportStyles.tableHeaderCell, { width: '22%' }]}>Pessoas FAUS</Text>
          <Text style={[reportStyles.tableHeaderCell, { width: '30%' }]}>Entregáveis</Text>
        </View>
        {selectedEntries.map((entry, index) => {
          const deliverables = limitItems(deliverablesByEntry.get(entry.id) ?? [], 3)

          return (
            <View key={entry.id} style={[reportStyles.tableRow, index % 2 === 1 ? reportStyles.tableRowAlt : {}]}>
              <Text style={[reportStyles.tableCell, { width: '30%' }]}>{entry.title}</Text>
              <Text style={[reportStyles.tableCell, { width: '18%' }]}>
                {formatReportDate(entry.start_date)} a {formatReportDate(entry.end_date)}
              </Text>
              <Text style={[reportStyles.tableCell, { width: '22%' }]}>
                {entry.faus_people.length ? entry.faus_people.join(', ') : 'Não informado.'}
              </Text>
              <Text style={[reportStyles.tableCell, { width: '30%' }]}>
                {deliverables.length ? deliverables.map(deliverable => deliverable.description).join('; ') : 'Sem entregáveis registrados.'}
              </Text>
            </View>
          )
        })}
      </View>

      {consulting.diaryEntries.length > selectedEntries.length ? (
        <Text style={reportStyles.moreNote}>Demais registros disponíveis no MOVE FLOW.</Text>
      ) : null}
    </Section>
  )
}

interface DistributionRow {
  label: string
  value: number
  color: string
}

function DistributionBars({
  title,
  total,
  rows,
  emptyMessage,
}: {
  title: string
  total: number
  rows: DistributionRow[]
  emptyMessage: string
}) {
  const safeTotal = Math.max(safeReportNumber(total, 0), 0)
  const chartWidth = 190
  const barHeight = 8

  return (
    <View
      style={{
        flex: 1,
        marginBottom: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: reportColors.line,
        borderRadius: 10,
        backgroundColor: reportColors.white,
      }}
    >
      <Text style={reportStyles.consultativeKicker}>{title}</Text>
      {safeTotal === 0 ? (
        <Text style={reportStyles.moreNote}>{emptyMessage}</Text>
      ) : (
        rows.map(row => {
          const value = Math.max(safeReportNumber(row.value, 0), 0)
          const percent = Math.round(safeReportPercent(value, safeTotal))
          const filledWidth = safeReportBarWidth(value, safeTotal, chartWidth)

          return (
            <View key={row.label} style={{ marginTop: 7 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ fontSize: 8, color: reportColors.ink }}>{row.label}</Text>
                <Text style={{ fontSize: 8, fontWeight: 700, color: reportColors.ink }}>
                  {value} | {percent}%
                </Text>
              </View>
              <ProgressBar width={chartWidth} height={barHeight} fillWidth={filledWidth} color={row.color} />
            </View>
          )
        })
      )}
    </View>
  )
}

function RateScoreVisual({
  score,
  previousScore,
  criticalAxes,
}: {
  score: number | null | undefined
  previousScore: number | null | undefined
  criticalAxes: RateAxisScore[]
}) {
  const scoreValue = safeReportScore(score, 5)
  const scoreBarWidth = safeReportBarWidth(scoreValue ?? 0, 5, 220)
  const variation = formatRateVariation(scoreValue, safeReportScore(previousScore, 5))
  const scoreWidth = 220

  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
      <View
        style={{
          flex: 1,
          padding: 12,
          borderWidth: 1,
          borderColor: reportColors.line,
          borderRadius: 10,
          backgroundColor: reportColors.softNeon,
        }}
      >
        <Text style={reportStyles.consultativeKicker}>Score geral Rate FAUS</Text>
        {scoreValue === null ? (
          <Text style={reportStyles.moreNote}>Não há score geral salvo para renderizar o medidor.</Text>
        ) : (
          <>
            <Text style={{ fontSize: 28, fontWeight: 700, color: reportColors.black }}>
              {formatRateScore(scoreValue)} / 5
            </Text>
            <ProgressBar
              width={scoreWidth}
              height={9}
              fillWidth={scoreBarWidth}
              color={reportColors.neon}
              backgroundColor={reportColors.white}
              markerWidth={safeReportBarWidth(3, 5, scoreWidth)}
            />
            <View style={{ marginTop: 7, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={reportStyles.moreNote}>0</Text>
              <Text style={reportStyles.moreNote}>média 3</Text>
              <Text style={reportStyles.moreNote}>máximo 5</Text>
            </View>
            <Text style={reportStyles.moreNote}>Evolução versus versão anterior: {variation}</Text>
          </>
        )}
      </View>

      <View
        style={{
          flex: 1,
          padding: 12,
          borderWidth: 1,
          borderColor: reportColors.line,
          borderRadius: 10,
          backgroundColor: reportColors.white,
        }}
      >
        <Text style={reportStyles.consultativeKicker}>Eixos críticos</Text>
        {criticalAxes.length === 0 ? (
          <Text style={reportStyles.moreNote}>Não há avaliações por eixo salvas.</Text>
        ) : (
          criticalAxes.map(axis => {
            const axisScore = safeReportScore(axis.score, 5)
            const color = axisScore !== null && axisScore < 3 ? reportColors.red : reportColors.orange
            const filledWidth = safeReportBarWidth(axisScore ?? 0, 5, scoreWidth)

            return (
              <View key={axis.axis} style={{ marginTop: 7 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ flex: 1, fontSize: 8, color: reportColors.ink }}>{axis.axis}</Text>
                  <Text style={{ fontSize: 8, fontWeight: 700, color: reportColors.ink }}>{formatRateScore(axisScore)}</Text>
                </View>
                <ProgressBar
                  width={scoreWidth}
                  height={7}
                  fillWidth={filledWidth}
                  color={color}
                  markerWidth={safeReportBarWidth(3, 5, scoreWidth)}
                />
              </View>
            )
          })
        )}
      </View>
    </View>
  )
}

function ProgressBar({
  width,
  height,
  fillWidth,
  color,
  backgroundColor = reportColors.soft,
  markerWidth,
}: {
  width: number
  height: number
  fillWidth: number
  color: string
  backgroundColor?: string
  markerWidth?: number
}) {
  const safeWidth = Math.max(safeReportNumber(width, 0), 0)
  const safeHeight = Math.max(safeReportNumber(height, 0), 0)
  const safeFillWidth = safeReportBarWidth(fillWidth, safeWidth, safeWidth)
  const safeMarkerWidth = markerWidth === undefined ? null : safeReportBarWidth(markerWidth, safeWidth, safeWidth)

  if (safeWidth <= 0 || safeHeight <= 0) return null

  return (
    <View
      style={{
        marginTop: 4,
        width: safeWidth,
        height: safeHeight,
        borderRadius: safeHeight,
        backgroundColor,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <View
        style={{
          width: safeFillWidth,
          height: safeHeight,
          borderRadius: safeHeight,
          backgroundColor: color,
        }}
      />
      {safeMarkerWidth !== null ? (
        <View
          style={{
            position: 'absolute',
            left: safeMarkerWidth,
            top: 0,
            width: 1,
            height: safeHeight,
            backgroundColor: reportColors.orange,
          }}
        />
      ) : null}
    </View>
  )
}

function buildKpiStatusDistribution(consulting: ReportConsultingData): DistributionRow[] {
  const recordsByKpi = groupBy(consulting.kpiRecords, record => record.kpi_id)
  const counts = {
    green: 0,
    yellow: 0,
    red: 0,
    empty: 0,
  }

  consulting.kpis.forEach(kpi => {
    const latestRecord = recordsByKpi.get(kpi.id)?.[0] ?? null
    if (!latestRecord) {
      counts.empty += 1
      return
    }

    counts[latestRecord.calculated_status] += 1
  })

  return [
    { label: PERFORMANCE_STATUS_LABELS.green ?? 'Verde', value: counts.green, color: reportColors.neon },
    { label: PERFORMANCE_STATUS_LABELS.yellow ?? 'Amarelo', value: counts.yellow, color: reportColors.orange },
    { label: PERFORMANCE_STATUS_LABELS.red ?? 'Vermelho', value: counts.red, color: reportColors.red },
    { label: 'Sem apuração', value: counts.empty, color: reportColors.muted },
  ]
}

function getExecutiveActionStats(actions: ReportData['actions'], referenceDate: string): ExecutiveActionStats {
  const completed = actions.filter(action => getActionVisualStatus(action, referenceDate) === 'completed').length
  const overdue = actions.filter(action => getActionVisualStatus(action, referenceDate) === 'overdue').length
  const inProgress = actions.filter(action => getActionVisualStatus(action, referenceDate) === 'in_progress').length
  const open = inProgress + overdue
  const total = actions.length
  const other = Math.max(total - completed - overdue - inProgress, 0)

  return {
    total,
    completed,
    inProgress,
    overdue,
    open,
    other,
    completionPercent: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const grouped = new Map<string, T[]>()

  items.forEach(item => {
    const key = getKey(item)
    grouped.set(key, [...(grouped.get(key) ?? []), item])
  })

  return grouped
}

function hasRedRecord(kpi: ReportKpi, recordsByKpi: Map<string, ReportConsultingData['kpiRecords']>) {
  return (recordsByKpi.get(kpi.id) ?? []).some(record => record.calculated_status === 'red')
}

function formatNumber(value: number | null | undefined, unit?: string | null) {
  if (value === null || value === undefined) return '—'
  const safeValue = safeReportNumber(value, Number.NaN)
  if (Number.isNaN(safeValue)) return '—'

  const formatted = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(safeValue)

  return unit ? `${formatted} ${unit}` : formatted
}

function formatFspLinks(fsp: ReportFsp, kpiMap: Map<string, string>) {
  const links: string[] = []

  if (fsp.kpi_id) {
    links.push(`KPI: ${kpiMap.get(fsp.kpi_id) ?? 'vinculado'}`)
  }
  if (fsp.action_id || fsp.linked_action_id || fsp.generated_action_id) {
    links.push('Ação vinculada')
  }

  return links.length > 0 ? links.join(' | ') : 'Sem vínculo real registrado'
}

function formatRateVariation(current: number | null | undefined, previous: number | null | undefined) {
  const currentScore = safeReportScore(current, 5)
  const previousScore = safeReportScore(previous, 5)

  if (currentScore === null || previousScore === null) {
    return '—'
  }

  const variation = Number((currentScore - previousScore).toFixed(2))
  return `${variation >= 0 ? '+' : ''}${formatRateScore(variation)}`
}

function ActionSummary({
  title,
  actions,
  referenceDate,
  hasMore = false,
  emptyMessage = 'Nenhum item disponível para esta seção.',
}: {
  title: string
  actions: ReportData['actions']
  referenceDate: string
  hasMore?: boolean
  emptyMessage?: string
}) {
  return (
    <Section title={title}>
      {actions.length === 0 ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <View style={reportStyles.table}>
          <View style={reportStyles.tableHeader}>
            <Text style={[reportStyles.tableHeaderCell, { width: '48%' }]}>Ação</Text>
            <Text style={[reportStyles.tableHeaderCell, { width: '18%' }]}>Status</Text>
            <Text style={[reportStyles.tableHeaderCell, { width: '17%' }]}>Responsável</Text>
            <Text style={[reportStyles.tableHeaderCell, { width: '17%' }]}>Prazo</Text>
          </View>
          {actions.map((action, index) => {
            const tone = getActionVisualStatusTone(action, referenceDate)

            return (
              <View key={action.id} style={[reportStyles.tableRow, index % 2 === 1 ? reportStyles.tableRowAlt : {}]}>
                <Text style={[reportStyles.tableCell, { width: '48%' }]}>{action.title}</Text>
                <View style={[reportStyles.tableCell, { width: '18%' }]}>
                  <Text style={[reportStyles.badge, getActionBadgeStyle(tone)]}>
                    {getActionVisualStatusLabel(action, referenceDate)}
                  </Text>
                </View>
                <Text style={[reportStyles.tableCell, { width: '17%' }]}>{action.responsible_name ?? '—'}</Text>
                <Text style={[reportStyles.tableCell, { width: '17%' }]}>{formatReportDate(action.due_date)}</Text>
              </View>
            )
          })}
        </View>
      )}
      {hasMore ? (
        <Text style={reportStyles.moreNote}>Demais registros disponíveis no MOVE FLOW.</Text>
      ) : null}
    </Section>
  )
}

function sortActionsByDueDate(left: ReportData['actions'][number], right: ReportData['actions'][number]) {
  if (!left.due_date && !right.due_date) return left.title.localeCompare(right.title)
  if (!left.due_date) return 1
  if (!right.due_date) return -1
  if (left.due_date === right.due_date) return left.title.localeCompare(right.title)
  return left.due_date.localeCompare(right.due_date)
}

function getActionBadgeStyle(tone: ReturnType<typeof getActionVisualStatusTone>) {
  if (tone === 'danger') {
    return {
      backgroundColor: reportColors.softRed,
      color: reportColors.red,
    }
  }
  if (tone === 'success') {
    return {
      backgroundColor: reportColors.softNeon,
      color: reportColors.black,
    }
  }
  if (tone === 'warning') {
    return {
      backgroundColor: reportColors.softOrange,
      color: reportColors.orange,
    }
  }

  return {}
}
