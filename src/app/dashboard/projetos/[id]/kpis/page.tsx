import type { Metadata } from 'next'
import Link from 'next/link'
import { BarChart3, ChevronRight } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import {
  formatMeasurementValue,
  KPI_ORIGIN_TYPE_LABELS,
  KPI_STATUS_COLORS,
  KPI_STATUS_LABELS,
  KPI_TREND_COLORS,
  KPI_TREND_LABELS,
  PERFORMANCE_STATUS_COLORS,
  PERFORMANCE_STATUS_LABELS,
} from '@/lib/utils'
import type {
  DiagnosisIndicator,
  Kpi,
  KpiPeriodRecord,
  KpiTargetPeriod,
  Project,
} from '@/types/database.types'

export const metadata: Metadata = { title: 'Dashboard de KPIs do Projeto' }

interface PageProps {
  params: { id: string }
}

type ProjectLookup = Pick<Project, 'id' | 'project_name' | 'main_consultant_id'>
type KpiLookup = Pick<
  Kpi,
  | 'id'
  | 'project_id'
  | 'kpi_name'
  | 'origin_type'
  | 'diagnosis_indicator_id'
  | 'unit_of_measure'
  | 'trend'
  | 'status'
  | 'visible_to_client'
>
type DiagnosisLookup = Pick<DiagnosisIndicator, 'id' | 'indicator_name' | 'baseline_value' | 'unit_of_measure'>
type TargetLookup = Pick<KpiTargetPeriod, 'id' | 'kpi_id' | 'period_label' | 'start_date' | 'end_date' | 'planned_target' | 'is_active'>
type RecordLookup = Pick<
  KpiPeriodRecord,
  'id' | 'kpi_id' | 'target_period_id' | 'actual_value' | 'calculated_status' | 'percentage_deviation' | 'justification' | 'period_status'
>

function getCurrentTargetPeriod(periods: TargetLookup[]) {
  const today = new Date().toISOString().slice(0, 10)
  return (
    periods.find(period => period.is_active && period.start_date <= today && period.end_date >= today) ??
    periods.find(period => period.is_active) ??
    periods[0] ??
    null
  )
}

export default async function ProjectKpiDashboardPage({ params }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const supabase = await createClient()
  const { data: projectData } = await supabase
    .from('projects')
    .select('id, project_name, main_consultant_id')
    .eq('id', params.id)
    .single()

  const project = (projectData as ProjectLookup | null) ?? null
  if (!project) notFound()
  const canManageKpis =
    session.profile.role === 'admin_faus' ||
    (session.profile.role === 'consultor_faus' && project.main_consultant_id === session.profile.id)

  const { data: kpisData } = await supabase
    .from('kpis')
    .select('id, project_id, kpi_name, origin_type, diagnosis_indicator_id, unit_of_measure, trend, status, visible_to_client')
    .eq('project_id', project.id)
    .order('kpi_name')

  const kpis = (kpisData as KpiLookup[] | null) ?? []
  const kpiIds = kpis.map(kpi => kpi.id)
  const diagnosisIds = Array.from(
    new Set(kpis.map(kpi => kpi.diagnosis_indicator_id).filter(Boolean) as string[])
  )

  const [diagnosisRes, periodsRes, recordsRes] = await Promise.all([
    diagnosisIds.length > 0
      ? supabase
          .from('diagnosis_indicators')
          .select('id, indicator_name, baseline_value, unit_of_measure')
          .in('id', diagnosisIds)
      : Promise.resolve({ data: [] as DiagnosisLookup[] | null }),
    kpiIds.length > 0
      ? supabase
          .from('kpi_target_periods')
          .select('id, kpi_id, period_label, start_date, end_date, planned_target, is_active')
          .in('kpi_id', kpiIds)
          .order('start_date', { ascending: false })
      : Promise.resolve({ data: [] as TargetLookup[] | null }),
    kpiIds.length > 0
      ? supabase
          .from('kpi_period_records')
          .select('id, kpi_id, target_period_id, actual_value, calculated_status, percentage_deviation, justification, period_status')
          .in('kpi_id', kpiIds)
          .order('recorded_at', { ascending: false })
      : Promise.resolve({ data: [] as RecordLookup[] | null }),
  ])

  const diagnosisMap = new Map(
    (((diagnosisRes.data as DiagnosisLookup[] | null) ?? [])).map(item => [item.id, item])
  )

  const periodsByKpi = new Map<string, TargetLookup[]>()
  ;(((periodsRes.data as TargetLookup[] | null) ?? [])).forEach(period => {
    periodsByKpi.set(period.kpi_id, [...(periodsByKpi.get(period.kpi_id) ?? []), period])
  })

  const recordsByPeriod = new Map(
    (((recordsRes.data as RecordLookup[] | null) ?? [])).map(record => [record.target_period_id, record])
  )

  const rows = kpis.map(kpi => {
    const currentPeriod = getCurrentTargetPeriod(periodsByKpi.get(kpi.id) ?? [])
    const currentRecord = currentPeriod ? recordsByPeriod.get(currentPeriod.id) ?? null : null
    const diagnosis = kpi.diagnosis_indicator_id ? diagnosisMap.get(kpi.diagnosis_indicator_id) ?? null : null

    return {
      ...kpi,
      currentPeriod,
      currentRecord,
      diagnosis,
    }
  })

  const summary = {
    total: rows.length,
    green: rows.filter(row => row.currentRecord?.calculated_status === 'green').length,
    yellow: rows.filter(row => row.currentRecord?.calculated_status === 'yellow').length,
    red: rows.filter(row => row.currentRecord?.calculated_status === 'red').length,
    noRecord: rows.filter(row => !row.currentRecord).length,
    diagnosisBased: rows.filter(row => !!row.diagnosis).length,
    visibleToClient: rows.filter(row => row.visible_to_client).length,
    relevantDeviation: rows.filter(row =>
      row.currentRecord &&
      (
        row.currentRecord.calculated_status !== 'green' ||
        Math.abs(row.currentRecord.percentage_deviation ?? 0) >= 10
      )
    ).length,
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard de KPIs</h1>
          <p className="page-subtitle">
            Visão executiva da performance de {project.project_name}, com meta, realizado, farol e baseline.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/projetos/${project.id}`} className="btn-secondary">
            Voltar ao projeto
          </Link>
          {canManageKpis && (
            <Link href="/dashboard/kpis/novo" className="btn-primary">
              Novo KPI
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total de KPIs', value: summary.total },
          { label: 'Verdes', value: summary.green },
          { label: 'Amarelos', value: summary.yellow },
          { label: 'Vermelhos', value: summary.red },
          { label: 'Sem apuração', value: summary.noRecord },
          { label: 'Com baseline', value: summary.diagnosisBased },
          { label: 'Visíveis ao cliente', value: summary.visibleToClient },
          { label: 'Desvio relevante', value: summary.relevantDeviation },
        ].map(item => (
          <div key={item.label} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold text-neutral-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <BarChart3 size={36} className="mx-auto mb-4 text-neutral-300" />
            <h2 className="text-base font-semibold text-neutral-900">Nenhum KPI neste projeto</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Cadastre KPIs para acompanhar metas, apurações e farol por período.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-5 py-3">KPI</th>
                  <th className="px-5 py-3">Origem / baseline</th>
                  <th className="px-5 py-3">Meta atual</th>
                  <th className="px-5 py-3">Realizado</th>
                  <th className="px-5 py-3">Farol</th>
                  <th className="px-5 py-3">Tendência</th>
                  <th className="px-5 py-3">Justificativa</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {rows.map(row => (
                  <tr key={row.id}>
                    <td className="px-5 py-4">
                      <div className="font-medium text-neutral-900">{row.kpi_name}</div>
                      {row.currentPeriod && (
                        <div className="text-xs text-neutral-400">{row.currentPeriod.period_label}</div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-neutral-700">
                      <div>{KPI_ORIGIN_TYPE_LABELS[row.origin_type]}</div>
                      {row.diagnosis && (
                        <div className="mt-1 text-xs text-neutral-400">
                          {row.diagnosis.indicator_name} • {formatMeasurementValue(row.diagnosis.baseline_value, row.diagnosis.unit_of_measure)}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-neutral-700">
                      {row.currentPeriod
                        ? formatMeasurementValue(row.currentPeriod.planned_target, row.unit_of_measure)
                        : '—'}
                    </td>
                    <td className="px-5 py-4 text-neutral-700">
                      {row.currentRecord
                        ? formatMeasurementValue(row.currentRecord.actual_value, row.unit_of_measure)
                        : '—'}
                    </td>
                    <td className="px-5 py-4">
                      {row.currentRecord ? (
                        <span className={`badge ${PERFORMANCE_STATUS_COLORS[row.currentRecord.calculated_status]}`}>
                          {PERFORMANCE_STATUS_LABELS[row.currentRecord.calculated_status]}
                        </span>
                      ) : (
                        <span className="text-neutral-400">Sem apuração</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {row.trend ? (
                        <span className={`badge ${KPI_TREND_COLORS[row.trend]}`}>
                          {KPI_TREND_LABELS[row.trend]}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-neutral-700">
                      <span className="line-clamp-2">
                        {row.currentRecord?.justification ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`badge ${KPI_STATUS_COLORS[row.status]}`}>
                        {KPI_STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`badge ${row.visible_to_client ? 'bg-blue-50 text-blue-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {row.visible_to_client ? 'Visível' : 'Interno'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/kpis/${row.id}`} className="btn-ghost">
                          Ver
                        </Link>
                        <Link href={`/dashboard/kpis/${row.id}`} className="btn-secondary">
                          <ChevronRight size={16} />
                          Abrir
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
