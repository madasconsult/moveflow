import type { Metadata } from 'next'
import Link from 'next/link'
import { History } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getActiveProjectContext } from '@/lib/active-project/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { ActiveProjectEmptyState } from '@/components/projects/ActiveProjectEmptyState'
import { formatDateTime } from '@/lib/utils'
import type { TimelineEvent, TimelineEventType } from '@/types/database.types'

export const metadata: Metadata = { title: 'Timeline' }

type TimelineEventRow = Pick<
  TimelineEvent,
  'id' | 'project_id' | 'event_type' | 'title' | 'description' | 'entity_type' | 'entity_id' | 'created_at'
>

const TIMELINE_EVENT_LABELS: Record<TimelineEventType, string> = {
  project_created: 'Projeto criado',
  phase_changed: 'Fase alterada',
  status_changed: 'Status alterado',
  action_created: 'Ação criada',
  action_completed: 'Ação concluída',
  meeting_registered: 'Reunião registrada',
  document_published: 'Documento publicado',
  kpi_updated: 'KPI atualizado',
  progress_updated: 'Progresso atualizado',
}

function getEntityHref(event: TimelineEventRow) {
  if (!event.entity_id || !event.entity_type) return null

  switch (event.entity_type) {
    case 'project':
      return `/dashboard/projetos/${event.entity_id}`
    case 'action':
      return `/dashboard/acoes/${event.entity_id}`
    case 'meeting':
      return `/dashboard/reunioes/${event.entity_id}`
    case 'document':
      return `/dashboard/documentos/${event.entity_id}`
    case 'kpi':
      return `/dashboard/kpis/${event.entity_id}`
  }
}

export default async function TimelinePage() {
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
            <h1 className="page-title">Timeline</h1>
            <p className="page-subtitle">
              Acompanhe o histórico cronológico do projeto ativo.
            </p>
          </div>
        </div>
        <ActiveProjectEmptyState />
      </div>
    )
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('timeline_events')
    .select('id, project_id, event_type, title, description, entity_type, entity_id, created_at')
    .eq('project_id', activeProjectId)
    .order('created_at', { ascending: false })

  const events: TimelineEventRow[] = (data as TimelineEventRow[] | null) ?? []

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Timeline</h1>
          <p className="page-subtitle">
            Histórico cronológico do projeto ativo: {activeProjectContext.activeProject?.project_name}.
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <History size={36} className="mb-4 text-neutral-300" />
            <h2 className="text-base font-semibold text-neutral-900">Nenhum evento registrado</h2>
            <p className="mt-1 max-w-md text-sm text-neutral-500">
              Nenhum evento registrado para este projeto.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {events.map(event => {
              const href = getEntityHref(event)

              return (
                <div key={event.id} className="flex gap-4 px-6 py-5 transition-colors hover:bg-neutral-50">
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <History size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge bg-blue-50 text-blue-700">
                        {TIMELINE_EVENT_LABELS[event.event_type]}
                      </span>
                      <span className="text-xs text-neutral-400">{formatDateTime(event.created_at)}</span>
                    </div>
                    <h2 className="mt-2 text-sm font-semibold text-neutral-900">{event.title}</h2>
                    {event.description && (
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">
                        {event.description}
                      </p>
                    )}
                    {href && (
                      <Link href={href} className="mt-3 inline-flex text-sm font-medium text-brand-600 hover:text-brand-700">
                        Abrir registro relacionado
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
