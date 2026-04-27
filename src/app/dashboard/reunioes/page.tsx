import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarDays, List, Plus } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import {
  MEETING_TYPE_COLORS,
  MEETING_TYPE_LABELS,
  formatDateTime,
} from '@/lib/utils'
import { MeetingCalendarView } from '@/components/meetings/MeetingCalendarView'
import type { Meeting, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Reuniões' }

type MeetingListItem = Pick<
  Meeting,
  | 'id'
  | 'project_id'
  | 'meeting_type'
  | 'meeting_date'
  | 'executive_summary'
  | 'participants'
  | 'visible_to_client'
  | 'updated_at'
>

type ProjectLookup = Pick<Project, 'id' | 'project_name'>

interface MeetingsPageProps {
  searchParams?: {
    view?: string
    period?: string
    date?: string
  }
}

export default async function MeetingsPage({ searchParams }: MeetingsPageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const view = searchParams?.view === 'calendar' ? 'calendar' : 'table'
  const period = searchParams?.period === 'week' || searchParams?.period === 'day' ? searchParams.period : 'month'
  const baseDate = searchParams?.date ? new Date(searchParams.date) : new Date()

  const supabase = await createClient()
  const { data } = await supabase
    .from('meetings')
    .select('id, project_id, meeting_type, meeting_date, executive_summary, participants, visible_to_client, updated_at')
    .order('meeting_date', { ascending: false })

  const meetings: MeetingListItem[] = (data as MeetingListItem[] | null) ?? []
  const projectIds = Array.from(new Set(meetings.map(meeting => meeting.project_id)))

  const projectsRes = projectIds.length > 0
    ? await supabase.from('projects').select('id, project_name').in('id', projectIds)
    : { data: [] as ProjectLookup[] | null }

  const projectMap = new Map(
    (((projectsRes.data as ProjectLookup[] | null) ?? [])).map(project => [project.id, project.project_name])
  )

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reuniões</h1>
          <p className="page-subtitle">
            Acompanhe reuniões em tabela ou calendário, com participantes persistidos e navegação por compromisso.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reunioes?view=table" className={view === 'table' ? 'btn-primary' : 'btn-secondary'}>
            <List size={16} />
            Tabela
          </Link>
          <Link href={`/dashboard/reunioes?view=calendar&period=${period}`} className={view === 'calendar' ? 'btn-primary' : 'btn-secondary'}>
            <CalendarDays size={16} />
            Calendário
          </Link>
          {session.profile.role === 'admin_faus' && (
            <Link href="/dashboard/reunioes/novo" className="btn-primary">
              <Plus size={16} />
              Nova reunião
            </Link>
          )}
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {(['month', 'week', 'day'] as const).map(option => (
              <Link
                key={option}
                href={`/dashboard/reunioes?view=calendar&period=${option}&date=${baseDate.toISOString().slice(0, 10)}`}
                className={period === option ? 'btn-primary' : 'btn-secondary'}
              >
                {option === 'month' ? 'Mês' : option === 'week' ? 'Semana' : 'Dia'}
              </Link>
            ))}
          </div>
          <MeetingCalendarView
            meetings={meetings}
            projectMap={projectMap}
            view={period}
            baseDate={baseDate}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          {meetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <CalendarDays size={36} className="mb-4 text-neutral-300" />
              <h2 className="text-base font-semibold text-neutral-900">Nenhuma reunião registrada</h2>
              <p className="mt-1 max-w-md text-sm text-neutral-500">
                {session.profile.role === 'admin_faus'
                  ? 'Crie o primeiro registro de reunião para acompanhar decisões e próximos passos dos projetos.'
                  : 'As reuniões dos projetos aos quais você está vinculado aparecerão aqui automaticamente.'}
              </p>
              {session.profile.role === 'admin_faus' && (
                <Link href="/dashboard/reunioes/novo" className="btn-primary mt-5">
                  <Plus size={16} />
                  Criar primeira reunião
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    <th className="px-5 py-3">Reunião</th>
                    <th className="px-5 py-3">Projeto</th>
                    <th className="px-5 py-3">Data</th>
                    <th className="px-5 py-3">Participantes</th>
                    <th className="px-5 py-3">Resumo</th>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {meetings.map(meeting => (
                    <tr key={meeting.id} className="transition-colors hover:bg-neutral-50">
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <Link
                            href={`/dashboard/reunioes/${meeting.id}`}
                            className="font-medium text-neutral-900 hover:text-brand-700"
                          >
                            {MEETING_TYPE_LABELS[meeting.meeting_type]}
                          </Link>
                          <span className={`badge ${MEETING_TYPE_COLORS[meeting.meeting_type]}`}>
                            {MEETING_TYPE_LABELS[meeting.meeting_type]}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-neutral-600">
                        {projectMap.get(meeting.project_id) ?? 'Projeto vinculado'}
                      </td>
                      <td className="px-5 py-4 text-neutral-600">
                        {formatDateTime(meeting.meeting_date)}
                      </td>
                      <td className="px-5 py-4 text-neutral-600">
                        {meeting.participants?.length ? `${meeting.participants.length} participante(s)` : 'Sem participantes'}
                      </td>
                      <td className="px-5 py-4 text-neutral-600">
                        <p className="truncate-2 max-w-md">
                          {meeting.executive_summary ?? 'Sem resumo executivo registrado.'}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`badge ${meeting.visible_to_client ? 'bg-blue-50 text-blue-700' : 'bg-neutral-100 text-neutral-500'}`}>
                          {meeting.visible_to_client ? 'Visível' : 'Interna'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/dashboard/reunioes/${meeting.id}`} className="btn-ghost">
                            Ver
                          </Link>
                          <Link href={`/dashboard/reunioes/${meeting.id}/editar`} className="btn-secondary">
                            Editar
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
      )}
    </div>
  )
}
