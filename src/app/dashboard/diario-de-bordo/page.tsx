import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpenText, CalendarDays, CheckCircle2, ClipboardList, Plus } from 'lucide-react'
import { redirect } from 'next/navigation'
import { ActiveProjectEmptyState } from '@/components/projects/ActiveProjectEmptyState'
import { DeleteDiaryEntryButton } from '@/components/diary/DeleteDiaryEntryButton'
import { DiaryMonthlyChart } from '@/components/diary/DiaryMonthlyChart'
import { getActiveProjectContext } from '@/lib/active-project/server'
import {
  buildDiaryMonthBuckets,
  formatDiaryDate,
  formatDiaryPeriod,
  isSameMonth,
} from '@/lib/diary-board'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import type { DiaryEntry, Profile, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Diário de Bordo' }

type DiaryEntryListItem = Pick<
  DiaryEntry,
  | 'id'
  | 'project_id'
  | 'title'
  | 'start_date'
  | 'end_date'
  | 'faus_people'
  | 'created_by'
  | 'created_at'
>

interface DeliverableStatusLookup {
  id: string
  diary_entry_id: string
  status: string | null
  is_carried_over: boolean
}

type ProfileLookup = Pick<Profile, 'id' | 'full_name'>
type ProjectPermissionLookup = Pick<Project, 'id' | 'main_consultant_id'>

interface EntrySummary {
  completed: number
  partial: number
  pending: number
  carried: number
  total: number
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: React.ElementType
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-900">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

function EntryStatusBadges({ summary }: { summary: EntrySummary }) {
  if (summary.total === 0) return <span className="text-neutral-400">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {summary.completed > 0 && (
        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
          {summary.completed} realiz.
        </span>
      )}
      {summary.partial > 0 && (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          {summary.partial} parcial
        </span>
      )}
      {summary.pending > 0 && (
        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
          {summary.pending} pend.
        </span>
      )}
      {summary.carried > 0 && (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
          {summary.carried} herd.
        </span>
      )}
    </div>
  )
}

export default async function DiaryBoardPage() {
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
            <h1 className="page-title">Diário de Bordo</h1>
            <p className="page-subtitle">
              Registro de dedicação da FAUS em visitas, semanas presenciais/remotas e entregáveis por projeto.
            </p>
          </div>
        </div>
        <ActiveProjectEmptyState />
      </div>
    )
  }

  const supabase = await createClient()
  const [entriesRes, activeProjectRes] = await Promise.all([
    supabase
      .from('diary_entries')
      .select('id, project_id, title, start_date, end_date, faus_people, created_by, created_at')
      .eq('project_id', activeProjectId)
      .is('deleted_at', null)
      .order('start_date', { ascending: false }),
    supabase
      .from('projects')
      .select('id, main_consultant_id')
      .eq('id', activeProjectId)
      .single(),
  ])

  const entries: DiaryEntryListItem[] = (entriesRes.data as DiaryEntryListItem[] | null) ?? []
  const entryIds = entries.map(entry => entry.id)

  const deliverablesRes = entryIds.length > 0
    ? await supabase
      .from('diary_deliverables')
      .select('id, diary_entry_id, status, is_carried_over')
      .in('diary_entry_id', entryIds)
    : { data: [] as DeliverableStatusLookup[] | null }

  const deliverables: DeliverableStatusLookup[] =
    (deliverablesRes.data as DeliverableStatusLookup[] | null) ?? []

  // Build per-entry summary map
  const summaryByEntry = new Map<string, EntrySummary>()
  deliverables.forEach(d => {
    const s = summaryByEntry.get(d.diary_entry_id) ?? {
      completed: 0, partial: 0, pending: 0, carried: 0, total: 0,
    }
    s.total++
    if (d.status === 'completed') s.completed++
    else if (d.status === 'partial') s.partial++
    else if (d.status === 'pending') s.pending++
    if (d.is_carried_over) s.carried++
    summaryByEntry.set(d.diary_entry_id, s)
  })

  const creatorIds = Array.from(new Set(entries.map(e => e.created_by).filter(Boolean) as string[]))
  const creatorsRes = creatorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', creatorIds)
    : { data: [] as ProfileLookup[] | null }

  const creatorMap = new Map(
    ((creatorsRes.data as ProfileLookup[] | null) ?? []).map(p => [p.id, p.full_name])
  )

  const rows = entries.map(entry => ({
    ...entry,
    deliverable_count: summaryByEntry.get(entry.id)?.total ?? 0,
    summary: summaryByEntry.get(entry.id) ?? { completed: 0, partial: 0, pending: 0, carried: 0, total: 0 },
    creator_name: entry.created_by ? creatorMap.get(entry.created_by) ?? 'Usuário vinculado' : 'Não informado',
  }))

  const monthBuckets = buildDiaryMonthBuckets(rows)
  const visitsThisMonth = rows.filter(entry => isSameMonth(entry.start_date)).length
  const deliverablesThisMonth = rows
    .filter(entry => isSameMonth(entry.start_date))
    .reduce((total, entry) => total + entry.deliverable_count, 0)
  const totalDeliverables = rows.reduce((total, entry) => total + entry.deliverable_count, 0)
  const isAdmin = session.profile.role === 'admin_faus'
  const activeProject = (activeProjectRes.data as ProjectPermissionLookup | null) ?? null
  const canManageDiary =
    isAdmin ||
    (session.profile.role === 'consultor_faus' && activeProject?.main_consultant_id === session.profile.id)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Diário de Bordo</h1>
          <p className="page-subtitle">
            Registro de dedicação da FAUS no projeto ativo: {activeProjectContext.activeProject?.project_name}.
          </p>
        </div>
        {canManageDiary && (
          <Link href="/dashboard/diario-de-bordo/novo" className="btn-primary">
            <Plus size={16} />
            Registrar Dedicação
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de visitas" value={rows.length} icon={CalendarDays} />
        <StatCard label="Total de entregáveis" value={totalDeliverables} icon={CheckCircle2} />
        <StatCard label="Visitas no mês" value={visitsThisMonth} icon={BookOpenText} />
        <StatCard label="Entregáveis no mês" value={deliverablesThisMonth} icon={ClipboardList} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DiaryMonthlyChart
          data={monthBuckets}
          metric="visits"
          title="Visitas mês a mês"
          emptyLabel="Nenhuma visita registrada para exibir."
        />
        <DiaryMonthlyChart
          data={monthBuckets}
          metric="deliverables"
          title="Entregáveis mês a mês"
          emptyLabel="Nenhum entregável registrado para exibir."
        />
      </div>

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <BookOpenText size={36} className="mb-4 text-neutral-300" />
            <h2 className="text-base font-semibold text-neutral-900">Nenhuma dedicação registrada</h2>
            <p className="mt-1 max-w-md text-sm text-neutral-500">
              Nenhum registro encontrado para este projeto.
            </p>
            {canManageDiary && (
              <Link href="/dashboard/diario-de-bordo/novo" className="btn-primary mt-5">
                <Plus size={16} />
                Registrar primeira dedicação
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <th className="px-5 py-3">Visita</th>
                  <th className="px-5 py-3">Período</th>
                  <th className="px-5 py-3">Pessoas FAUS</th>
                  <th className="px-5 py-3">Entregáveis</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Criado por</th>
                  <th className="px-5 py-3">Criado em</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map(entry => (
                  <tr key={entry.id} className="transition-colors hover:bg-neutral-50">
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/diario-de-bordo/${entry.id}`}
                        className="font-medium text-neutral-900 hover:text-brand-700"
                      >
                        {entry.title}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {formatDiaryPeriod(entry.start_date, entry.end_date)}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      <p className="max-w-48 whitespace-normal">
                        {entry.faus_people.join(', ')}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {entry.deliverable_count}
                    </td>
                    <td className="px-5 py-4">
                      <EntryStatusBadges summary={entry.summary} />
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {entry.creator_name}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {formatDiaryDate(entry.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/diario-de-bordo/${entry.id}`} className="btn-ghost">
                          Ver
                        </Link>
                        {canManageDiary && (
                          <Link href={`/dashboard/diario-de-bordo/${entry.id}/editar`} className="btn-secondary">
                            Editar
                          </Link>
                        )}
                        {isAdmin && (
                          <DeleteDiaryEntryButton entryId={entry.id} />
                        )}
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
