import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, CheckSquare } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'
import {
  ACTION_PRIORITY_COLORS,
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_COLORS,
  ACTION_STATUS_LABELS,
  cn,
  formatDate,
} from '@/lib/utils'
import type { Action, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Ações' }

type PortalProject = Pick<Project, 'id' | 'project_name' | 'client_id'>
type PortalAction = Pick<
  Action,
  | 'id'
  | 'project_id'
  | 'title'
  | 'description'
  | 'due_date'
  | 'priority'
  | 'status'
  | 'completion_date'
  | 'visible_to_client'
>

function getActionSortDate(action: PortalAction) {
  return action.due_date ?? '9999-12-31'
}

function isActionOverdue(action: PortalAction) {
  if (!action.due_date || action.completion_date || action.status === 'completed') return false
  return action.due_date < new Date().toISOString().slice(0, 10)
}

export default async function PortalActionsPage() {
  const session = await getSessionWithProfile()
  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')

  const { profile } = session
  if (profile.role !== 'cliente') redirect('/dashboard')

  if (!profile.client_id) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card p-10 text-center">
          <CheckSquare size={36} className="mx-auto mb-4 text-neutral-300" />
          <h1 className="text-lg font-semibold text-neutral-900">Nenhum cliente vinculado</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Seu usuário ainda não possui um cliente vinculado. Entre em contato com a equipe FAUS.
          </p>
        </div>
      </div>
    )
  }

  const supabase = await createClient()

  const { data: projectsData } = await supabase
    .from('projects')
    .select('id, project_name, client_id')
    .eq('client_id', profile.client_id)
    .order('project_name', { ascending: true })

  const projects = (projectsData as PortalProject[] | null) ?? []
  const projectIds = projects.map(project => project.id)
  const projectNameMap = new Map(projects.map(project => [project.id, project.project_name]))

  const { data: actionsData } = projectIds.length > 0
    ? await supabase
        .from('actions')
        .select('id, project_id, title, description, due_date, priority, status, completion_date, visible_to_client')
        .in('project_id', projectIds)
        .eq('visible_to_client', true)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('title', { ascending: true })
    : { data: [] }

  const actions = ((actionsData as PortalAction[] | null) ?? [])
    .filter(action => action.visible_to_client)
    .sort((firstAction, secondAction) => {
      const firstOverdue = isActionOverdue(firstAction)
      const secondOverdue = isActionOverdue(secondAction)
      if (firstOverdue !== secondOverdue) return firstOverdue ? -1 : 1

      const dateCompare = getActionSortDate(firstAction).localeCompare(getActionSortDate(secondAction))
      if (dateCompare !== 0) return dateCompare

      return firstAction.title.localeCompare(secondAction.title, 'pt-BR')
    })

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/portal" className="btn-secondary mb-4 inline-flex">
          <ArrowLeft size={16} />
          Voltar ao Projeto
        </Link>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Portal do cliente
        </p>
        <h1 className="text-2xl font-semibold text-neutral-900">Ações liberadas para acompanhamento</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Acompanhe apenas as ações que a equipe FAUS liberou para visualização externa.
        </p>
      </div>

      {actions.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckSquare size={40} className="mx-auto mb-4 text-neutral-300" />
          <h2 className="text-lg font-semibold text-neutral-900">
            Nenhuma ação liberada para acompanhamento no momento.
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Quando houver ações compartilhadas pela equipe FAUS, elas aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {actions.map(action => {
            const overdue = isActionOverdue(action)

            return (
              <article key={action.id} className="card p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('badge', ACTION_STATUS_COLORS[action.status])}>
                        {overdue ? 'Atrasada' : ACTION_STATUS_LABELS[action.status]}
                      </span>
                      <span className={cn('badge', ACTION_PRIORITY_COLORS[action.priority])}>
                        Prioridade {ACTION_PRIORITY_LABELS[action.priority]}
                      </span>
                    </div>
                    <h2 className="text-base font-semibold text-neutral-900">{action.title}</h2>
                    {action.description && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">
                        {action.description}
                      </p>
                    )}
                  </div>

                  <div className="min-w-[180px] rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                    <p>
                      <span className="text-neutral-400">Prazo:</span>{' '}
                      <span className={overdue ? 'font-semibold text-red-700' : 'text-neutral-800'}>
                        {formatDate(action.due_date)}
                      </span>
                    </p>
                    <p className="mt-1">
                      <span className="text-neutral-400">Projeto:</span>{' '}
                      <span className="text-neutral-800">
                        {projectNameMap.get(action.project_id) ?? 'Projeto vinculado'}
                      </span>
                    </p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
