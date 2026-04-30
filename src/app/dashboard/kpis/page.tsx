import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, TrendingUp } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getActiveProjectContext } from '@/lib/active-project/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { ActiveProjectEmptyState } from '@/components/projects/ActiveProjectEmptyState'
import {
  formatMeasurementValue,
  KPI_STATUS_COLORS,
  KPI_STATUS_LABELS,
  KPI_TREND_COLORS,
  KPI_TREND_LABELS,
  formatDate,
} from '@/lib/utils'
import type { DiagnosisIndicator, Kpi, Project, Profile } from '@/types/database.types'

export const metadata: Metadata = { title: 'KPIs' }

type KpiListItem = Pick<
  Kpi,
  | 'id'
  | 'project_id'
  | 'kpi_name'
  | 'responsible_id'
  | 'diagnosis_indicator_id'
  | 'current_value'
  | 'target_value'
  | 'unit_of_measure'
  | 'status'
  | 'trend'
  | 'visible_to_client'
  | 'updated_at'
>

type ProjectLookup = Pick<Project, 'id' | 'project_name'>
type ResponsibleLookup = Pick<Profile, 'id' | 'full_name'>
type DiagnosisLookup = Pick<DiagnosisIndicator, 'id' | 'unit_of_measure'>

export default async function KpisPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const activeProjectContext = await getActiveProjectContext(session.profile)
  const activeProjectId = activeProjectContext.activeProjectId

  if (!activeProjectId) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">KPIs</h1>
            <p className="page-subtitle">
              Acompanhe indicadores do projeto ativo.
            </p>
          </div>
        </div>
        <ActiveProjectEmptyState />
      </div>
    )
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('kpis')
    .select('id, project_id, kpi_name, responsible_id, diagnosis_indicator_id, current_value, target_value, unit_of_measure, status, trend, visible_to_client, updated_at')
    .eq('project_id', activeProjectId)
    .order('updated_at', { ascending: false })

  const kpis: KpiListItem[] = (data as KpiListItem[] | null) ?? []
  const projectIds = Array.from(new Set(kpis.map(kpi => kpi.project_id)))
  const responsibleIds = Array.from(
    new Set(kpis.map(kpi => kpi.responsible_id).filter(Boolean) as string[])
  )
  const diagnosisIds = Array.from(
    new Set(kpis.map(kpi => kpi.diagnosis_indicator_id).filter(Boolean) as string[])
  )

  const [projectsRes, responsiblesRes, diagnosisRes] = await Promise.all([
    projectIds.length > 0
      ? supabase.from('projects').select('id, project_name').in('id', projectIds)
      : Promise.resolve({ data: [] as ProjectLookup[] | null }),
    responsibleIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', responsibleIds)
      : Promise.resolve({ data: [] as ResponsibleLookup[] | null }),
    diagnosisIds.length > 0
      ? supabase.from('diagnosis_indicators').select('id, unit_of_measure').in('id', diagnosisIds)
      : Promise.resolve({ data: [] as DiagnosisLookup[] | null }),
  ])

  const projectMap = new Map(
    (((projectsRes.data as ProjectLookup[] | null) ?? [])).map(project => [project.id, project.project_name])
  )
  const responsibleMap = new Map(
    (((responsiblesRes.data as ResponsibleLookup[] | null) ?? [])).map(profile => [profile.id, profile.full_name])
  )
  const diagnosisUnitMap = new Map(
    (((diagnosisRes.data as DiagnosisLookup[] | null) ?? [])).map(indicator => [indicator.id, indicator.unit_of_measure])
  )

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">KPIs</h1>
          <p className="page-subtitle">
            Acompanhe indicadores do projeto ativo: {activeProjectContext.activeProject?.project_name}.
          </p>
        </div>
        {session.profile.role === 'admin_faus' && (
          <Link href="/dashboard/kpis/novo" className="btn-primary">
            <Plus size={16} />
            Novo KPI
          </Link>
        )}
      </div>

      <div className="card overflow-hidden">
        {kpis.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <TrendingUp size={36} className="mb-4 text-neutral-300" />
            <h2 className="text-base font-semibold text-neutral-900">Nenhum KPI disponível</h2>
            <p className="mt-1 max-w-md text-sm text-neutral-500">
              Nenhum registro encontrado para este projeto.
            </p>
            {session.profile.role === 'admin_faus' && (
              <Link href="/dashboard/kpis/novo" className="btn-primary mt-5">
                <Plus size={16} />
                Criar primeiro KPI
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <th className="px-5 py-3">KPI</th>
                  <th className="px-5 py-3">Projeto</th>
                  <th className="px-5 py-3">Responsável</th>
                  <th className="px-5 py-3">Atual / Meta</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Tendência</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {kpis.map(kpi => {
                  const effectiveUnit =
                    kpi.unit_of_measure ??
                    (kpi.diagnosis_indicator_id
                      ? diagnosisUnitMap.get(kpi.diagnosis_indicator_id) ?? null
                      : null)

                  return (
                  <tr key={kpi.id} className="transition-colors hover:bg-neutral-50">
                    <td className="px-5 py-4">
                      <div>
                        <Link
                          href={`/dashboard/kpis/${kpi.id}`}
                          className="font-medium text-neutral-900 hover:text-brand-700"
                        >
                          {kpi.kpi_name}
                        </Link>
                        <p className="mt-1 text-xs text-neutral-400">
                          Atualizado em {formatDate(kpi.updated_at)}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {projectMap.get(kpi.project_id) ?? 'Projeto vinculado'}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {kpi.responsible_id
                        ? responsibleMap.get(kpi.responsible_id) ?? 'Responsável vinculado'
                        : 'Não definido'}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      <span className="font-medium text-neutral-900">
                        {formatMeasurementValue(kpi.current_value, effectiveUnit)}
                      </span>
                      <span className="mx-1 text-neutral-400">/</span>
                      <span>{formatMeasurementValue(kpi.target_value, effectiveUnit)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`badge ${KPI_STATUS_COLORS[kpi.status]}`}>
                        {KPI_STATUS_LABELS[kpi.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {kpi.trend ? (
                        <span className={`badge ${KPI_TREND_COLORS[kpi.trend]}`}>
                          {KPI_TREND_LABELS[kpi.trend]}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`badge ${kpi.visible_to_client ? 'bg-blue-50 text-blue-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {kpi.visible_to_client ? 'Visível' : 'Interno'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/kpis/${kpi.id}`} className="btn-ghost">
                          Ver
                        </Link>
                        <Link href={`/dashboard/kpis/${kpi.id}/editar`} className="btn-secondary">
                          Editar
                        </Link>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
