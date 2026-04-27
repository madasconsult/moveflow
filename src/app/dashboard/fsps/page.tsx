import type { Metadata } from 'next'
import Link from 'next/link'
import { SearchCheck } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import {
  FSP_METHOD_TYPE_LABELS,
  FSP_SOURCE_TYPE_LABELS,
  FSP_STATUS_COLORS,
  FSP_STATUS_LABELS,
  formatDate,
} from '@/lib/utils'
import type { Fsp, Kpi, Profile, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'FSPs' }

type FspListItem = Pick<
  Fsp,
  'id' | 'project_id' | 'title' | 'source_type' | 'kpi_id' | 'linked_action_id' | 'generated_action_id' | 'method_type' | 'status' | 'owner_id' | 'opened_at'
>
type ProjectLookup = Pick<Project, 'id' | 'project_name'>
type ResponsibleLookup = Pick<Profile, 'id' | 'full_name'>
type KpiLookup = Pick<Kpi, 'id' | 'kpi_name'>

export default async function FspsPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const supabase = await createClient()
  const { data } = await supabase
    .from('fsps')
    .select('id, project_id, title, source_type, kpi_id, linked_action_id, generated_action_id, method_type, status, owner_id, opened_at')
    .order('opened_at', { ascending: false })

  const fsps: FspListItem[] = (data as FspListItem[] | null) ?? []
  const projectIds = Array.from(new Set(fsps.map(item => item.project_id)))
  const ownerIds = Array.from(new Set(fsps.map(item => item.owner_id).filter(Boolean) as string[]))
  const kpiIds = Array.from(new Set(fsps.map(item => item.kpi_id).filter(Boolean) as string[]))

  const [projectsRes, ownersRes, kpisRes] = await Promise.all([
    projectIds.length > 0
      ? supabase.from('projects').select('id, project_name').in('id', projectIds)
      : Promise.resolve({ data: [] as ProjectLookup[] | null }),
    ownerIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', ownerIds)
      : Promise.resolve({ data: [] as ResponsibleLookup[] | null }),
    kpiIds.length > 0
      ? supabase.from('kpis').select('id, kpi_name').in('id', kpiIds)
      : Promise.resolve({ data: [] as KpiLookup[] | null }),
  ])

  const projectMap = new Map((((projectsRes.data as ProjectLookup[] | null) ?? [])).map(item => [item.id, item.project_name]))
  const ownerMap = new Map((((ownersRes.data as ResponsibleLookup[] | null) ?? [])).map(item => [item.id, item.full_name]))
  const kpiMap = new Map((((kpisRes.data as KpiLookup[] | null) ?? [])).map(item => [item.id, item.kpi_name]))

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">FSPs</h1>
          <p className="page-subtitle">
            Acompanhe análises estruturadas de problema por KPI/período ou por ação, com método, status e desdobramento.
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        {fsps.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <SearchCheck size={36} className="mb-4 text-neutral-300" />
            <h2 className="text-base font-semibold text-neutral-900">Nenhuma FSP disponível</h2>
            <p className="mt-1 max-w-md text-sm text-neutral-500">
              Crie uma FSP a partir de uma apuração de KPI/período ou a partir de uma ação existente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <th className="px-5 py-3">Título</th>
                  <th className="px-5 py-3">Projeto</th>
                  <th className="px-5 py-3">Origem</th>
                  <th className="px-5 py-3">Método</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Responsável</th>
                  <th className="px-5 py-3">Abertura</th>
                  <th className="px-5 py-3">Ação?</th>
                  <th className="px-5 py-3">KPI?</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {fsps.map(fsp => (
                  <tr key={fsp.id} className="transition-colors hover:bg-neutral-50">
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/fsps/${fsp.id}`} className="font-medium text-neutral-900 hover:text-brand-700">
                        {fsp.title}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-neutral-600">{projectMap.get(fsp.project_id) ?? 'Projeto vinculado'}</td>
                    <td className="px-5 py-4 text-neutral-600">{FSP_SOURCE_TYPE_LABELS[fsp.source_type]}</td>
                    <td className="px-5 py-4 text-neutral-600">{FSP_METHOD_TYPE_LABELS[fsp.method_type]}</td>
                    <td className="px-5 py-4">
                      <span className={`badge ${FSP_STATUS_COLORS[fsp.status]}`}>{FSP_STATUS_LABELS[fsp.status]}</span>
                    </td>
                    <td className="px-5 py-4 text-neutral-600">{fsp.owner_id ? ownerMap.get(fsp.owner_id) ?? 'Responsável vinculado' : 'Não definido'}</td>
                    <td className="px-5 py-4 text-neutral-600">{formatDate(fsp.opened_at)}</td>
                    <td className="px-5 py-4 text-neutral-600">{fsp.generated_action_id || fsp.linked_action_id ? 'Sim' : 'Não'}</td>
                    <td className="px-5 py-4 text-neutral-600">{fsp.kpi_id ? kpiMap.get(fsp.kpi_id) ?? 'KPI vinculado' : '—'}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/fsps/${fsp.id}`} className="btn-ghost">Ver</Link>
                        <Link href={`/dashboard/fsps/${fsp.id}/editar`} className="btn-secondary">Editar</Link>
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
