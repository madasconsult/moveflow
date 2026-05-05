import { Image, Page, Text, View } from '@react-pdf/renderer'
import { reportColors, reportStyles } from '@/components/reports/pdf/ReportTheme'
import { formatReportDateTime, getReportPeriodLabel } from '@/components/reports/pdf/utils'
import type { ReportData } from '@/components/reports/pdf/types'

interface ReportCoverProps {
  title: string
  subtitle: string
  data: ReportData
}

interface ReportPageProps {
  title: string
  data: ReportData
  children: React.ReactNode
}

type MetricTone = 'neutral' | 'success' | 'warning' | 'danger'

export function ReportCover({ title, subtitle, data }: ReportCoverProps) {
  return (
    <Page size="A4" style={reportStyles.cover}>
      <View style={reportStyles.coverShell}>
        <View style={reportStyles.coverTop}>
          {data.assets?.logoWhite ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={data.assets.logoWhite} style={reportStyles.coverLogo} />
          ) : (
            <Text style={{ fontSize: 18, fontWeight: 700 }}>FAUS</Text>
          )}
          <Text style={reportStyles.coverKicker}>MOVE REPORT</Text>
        </View>

        <View style={reportStyles.coverAccent} />
        <View style={reportStyles.coverOrangeAccent} />

        <Text style={reportStyles.coverTitle}>{title}</Text>
        <Text style={reportStyles.coverSubtitle}>{subtitle}</Text>

        <View style={reportStyles.coverInfoPanel}>
          <InfoRow label="Cliente" value={data.project.client_name ?? 'Não informado'} />
          <InfoRow label="Projeto" value={data.project.project_name} />
          <InfoRow label="Período analisado" value={getReportPeriodLabel(data)} />
          <InfoRow label="Data de geração" value={formatReportDateTime(data.generatedAt)} />
        </View>

        <View style={reportStyles.coverFooter}>
          <Text>MOVE REPORT | FAUS Soluções Estratégicas</Text>
          <Text>Documento executivo de acompanhamento</Text>
        </View>
      </View>
    </Page>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={reportStyles.coverInfoLabel}>{label}</Text>
      <Text style={reportStyles.coverInfoValue}>{value}</Text>
    </View>
  )
}

export function ReportPage({ title, data, children }: ReportPageProps) {
  return (
    <Page size="A4" style={reportStyles.page}>
      <View style={reportStyles.header} fixed>
        <View style={{ flex: 1 }}>
          <Text style={reportStyles.headerTitle}>{title}</Text>
          <Text style={reportStyles.headerText}>
            {data.project.client_name ?? 'Cliente não informado'} | {data.project.project_name}
          </Text>
          <Text style={reportStyles.headerText}>Período: {getReportPeriodLabel(data)}</Text>
        </View>
        {data.assets?.logoBlack ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={data.assets.logoBlack} style={reportStyles.headerLogo} />
        ) : (
          <Text style={{ fontSize: 10, fontWeight: 700 }}>FAUS</Text>
        )}
      </View>

      {children}

      <View style={reportStyles.footer} fixed>
        <Text style={reportStyles.footerBrand}>FAUS Soluções Estratégicas | MOVE REPORT</Text>
        <Text>Gerado em {formatReportDateTime(data.generatedAt)}</Text>
        <Text
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        />
      </View>
    </Page>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={reportStyles.section}>
      <View style={reportStyles.sectionHeader}>
        <View style={reportStyles.sectionMark} />
        <Text style={reportStyles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <View style={reportStyles.emptyState}>
      <Text>{children}</Text>
    </View>
  )
}

export function MetricCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  tone?: MetricTone
}) {
  const toneStyle =
    tone === 'success'
      ? reportStyles.metricCardStrong
      : tone === 'warning'
        ? reportStyles.metricCardWarning
        : tone === 'danger'
          ? reportStyles.metricCardDanger
          : {}
  const valueColor =
    tone === 'success'
      ? reportColors.black
      : tone === 'warning'
        ? reportColors.orange
        : tone === 'danger'
          ? reportColors.red
          : reportColors.black

  return (
    <View style={[reportStyles.metricCard, toneStyle]}>
      <Text style={reportStyles.metricLabel}>{label}</Text>
      <Text style={[reportStyles.metricValue, { color: valueColor }]}>{value}</Text>
    </View>
  )
}
