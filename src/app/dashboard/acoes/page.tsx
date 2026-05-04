import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckSquare, Plus, Rows4, Workflow } from 'lucide-react'
import { redirect } from 'next/navigation'
import { calculateActionStepProgress } from '@/lib/action-steps'
import {
  getActionProgressPercent,
  groupActionsByStatus,
  isActionOverdue,
  sortActionsByDueDate,
} from '@/lib/action-pipeline'
import { getActiveProjectContext } from '@/lib/active-project/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { ActiveProjectEmptyState } from '@/components/projects/ActiveProjectEmptyState'
import {
  ACTION_PRIORITY_COLORS,
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_COLORS,
  ACTION_STATUS_LABELS,
  formatDate,
} from '@/lib/utils'
import type { Action, ActionStep, Project, Profile } from '@/types/database.types'

export const metadata: Metadata = { title: 'Ações' }

type ActionListItem = Pick<
  Action,
  | 'id'
  | 'business_id'
  | 'project_id'
  | 'title'
  | 'assigned_to'
  | 'status'
  | 'priority'
  | 'due_date'
  | 'completion_date'
  | 'visible_to_client'
  | 'updated_at'
>

type ProjectLookup = Pick<Project, 'id' | 'project_name'>
type ProfileLookup = Pick<Profile, 'id' | 'full_name'>
type StepLookup = Pick<ActionStep, 'action_id' | 'status'>

const ACTION_PIPELINE_STATUS_LABELS = {
  overdue_pipeline: 'Atrasadas',
  ...ACTION_STATUS_LABELS,
}

const ACTION_PIPELINE_STATUS_COLORS = {
  overdue_pipeline: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  ...ACTION_STATUS_COLORS,
}

interface ActionsPageProps {
  searchParams?: {
    view?: string
    statusGroup?: string
  }
}

export default async function ActionsPage({ searchParams }: ActionsPageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const view = searchParams?.view === 'pipeline' ? 'pipeline' : 'list'
  const statusGroup = searchParams?.statusGroup ?? ''
  const activeProjectContext = await getActiveProjectContext(session.profile)
  const activeProjectId = activeProjectContext.activeProjectId

  if (!activeProjectId) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Ações</h1>
            <p className="page-subtitle">
              Acompanhe ações por tabela ou pipeline, com conclusão formal, ID de negócio e filtros locais.
            </p>
          </div>
        </div>
        <ActiveProjectEmptyState />
      </div>
    )
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('actions')
    .select('id, business_id, project_id, title, assigned_to, status, priority, due_date, completion_date, visible_to_client, updated_at')
    .eq('project_id', activeProjectId)
    .order('due_date', { ascending: true, nullsFirst: false })

  let actions: ActionListItem[] = (data as ActionListItem[] | null) ?? []

  if (statusGroup === 'pending') {
    actions = actions.filter(action => ['not_started', 'in_progress', 'waiting_faus'].includes(action.status))
  } else if (statusGroup === 'overdue') {
    actions = actions.filter(action => action.status === 'overdue')
  } else if (statusGroup === 'waiting_client') {
    actions = actions.filter(action => action.status === 'waiting_client')
  }

  const projectIds = Array.from(new Set(actions.map(action => action.project_id)))
  const responsibleIds = Array.from(
    new Set(actions.map(action => action.assigned_to).filter(Boolean) as string[])
  )

  const [projectsRes, responsiblesRes, stepsRes] = await Promise.all([
    projectIds.length > 0
      ? supabase.from('projects').select('id, project_name').in('id', projectIds)
      : Promise.resolve({ data: [] as ProjectLookup[] | null }),
    responsibleIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', responsibleIds)
      : Promise.resolve({ data: [] as ProfileLookup[] | null }),
    actions.length > 0
      ? supabase.from('action_steps').select('action_id, status').in('action_id', actions.map(action => action.id))
      : Promise.resolve({ data: [] as StepLookup[] | null }),
  ])

  const projectMap = new Map(
    (((projectsRes.data as ProjectLookup[] | null) ?? [])).map(project => [project.id, project.project_name])
  )
  const responsibleMap = new Map(
    (((responsiblesRes.data as ProfileLookup[] | null) ?? [])).map(profile => [profile.id, profile.full_name])
  )
  const stepsByAction = new Map<string, StepLookup[]>()
  ;(((stepsRes.data as StepLookup[] | null) ?? [])).forEach(step => {
    stepsByAction.set(step.action_id, [...(stepsByAction.get(step.action_id) ?? []), step])
  })

  const pipelineColumns = groupActionsByStatus(sortActionsByDueDate(actions)).map(column => ({
    status: column.status,
    label: ACTION_PIPELINE_STATUS_LABELS[column.status],
    actions: column.actions,
  }))

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ações</h1>
          <p className="page-subtitle">
            Acompanhe ações por tabela ou pipeline no projeto ativo: {activeProjectContext.activeProject?.project_name}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/acoes?view=list${statusGroup ? `&statusGroup=${statusGroup}` : ''}`}
            className={view === 'list' ? 'btn-primary' : 'btn-secondary'}
          >
            <Rows4 size={16} />
            Lista
          </Link>
          <Link
            href={`/dashboard/acoes?view=pipeline${statusGroup ? `&statusGroup=${statusGroup}` : ''}`}
            className={view === 'pipeline' ? 'btn-primary' : 'btn-secondary'}
          >
            <Workflow size={16} />
            Pipeline
          </Link>
          {session.profile.role === 'admin_faus' && (
            <Link href="/dashboard/acoes/novo" className="btn-primary">
              <Plus size={16} />
              Nova ação
            </Link>
          )}
        </div>
      </div>

      {actions.length === 0 && view === 'list' ? (
        <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
          <CheckSquare size={36} className="mb-4 text-neutral-300" />
          <h2 className="text-base font-semibold text-neutral-900">Nenhuma ação disponível</h2>
          <p className="mt-1 max-w-md text-sm text-neutral-500">
            Nenhum registro encontrado para este projeto.
          </p>
          {session.profile.role === 'admin_faus' && (
            <Link href="/dashboard/acoes/novo" className="btn-primary mt-5">
              <Plus size={16} />
              Criar primeira ação
            </Link>
          )}
        </div>
      ) : view === 'pipeline' ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-4">
          {pipelineColumns.map(column => (
            <div key={column.status} className="card flex w-[320px] shrink-0 flex-col p-4">
              <div className="flex items-center justify-between gap-3">
                <span className={`badge ${ACTION_PIPELINE_STATUS_COLORS[column.status]}`}>
                  {column.label}
                </span>
                <span className="text-xs text-neutral-400">{column.actions.length}</span>
              </div>

              <div className="mt-4 flex-1 space-y-3">
                {column.actions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-400">
                    Nenhuma ação nesta coluna.
                  </div>
                ) : (
                  column.actions.map(action => {
                    const steps = stepsByAction.get(action.id) ?? []
                    const progress = calculateActionStepProgress(steps)
                    const progressPercentage = getActionProgressPercent(action, steps)
                    const overdue = isActionOverdue(action)

                    return (
                      <Link
                        key={action.id}
                        href={`/dashboard/acoes/${action.id}`}
                        className="block rounded-2xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                            {action.business_id ?? 'Sem ID'}
                          </p>
                          {overdue && (
                            <span className="badge bg-red-50 text-red-700 ring-1 ring-inset ring-red-200">
                              Atrasada
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm font-semibold leading-snug text-neutral-900">{action.title}</p>
                        <p className="mt-2 text-xs text-neutral-500">
                          {projectMap.get(action.project_id) ?? 'Projeto vinculado'}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {action.assigned_to
                            ? responsibleMap.get(action.assigned_to) ?? 'Responsável vinculado'
                            : 'Responsável não definido'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`badge ${ACTION_STATUS_COLORS[action.status]}`}>
                            {ACTION_STATUS_LABELS[action.status]}
                          </span>
                          <span className={`badge ${ACTION_PRIORITY_COLORS[action.priority]}`}>
                            {ACTION_PRIORITY_LABELS[action.priority]}
                          </span>
                          <span className={`badge ${overdue ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200' : 'bg-neutral-100 text-neutral-600'}`}>
                            {action.due_date ? formatDate(action.due_date) : 'Sem prazo'}
                          </span>
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[11px] text-neutral-500">
                            <span>Andamento</span>
                            <span>{progressPercentage}%</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className="h-full rounded-full bg-brand-600"
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                          <div className="mt-1 text-[11px] text-neutral-400">
                            {progress.total > 0
                              ? `${progress.completed}/${progress.total} etapas concluídas`
                              : 'Sem etapas cadastradas'}
                          </div>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            </div>
          ))}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">Título</th>
                  <th className="px-5 py-3">Projeto</th>
                  <th className="px-5 py-3">Responsável</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Prioridade</th>
                  <th className="px-5 py-3">Prazo</th>
                  <th className="px-5 py-3">Conclusão</th>
                  <th className="px-5 py-3">Etapas</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {actions.map(action => (
                  <tr key={action.id} className="transition-colors hover:bg-neutral-50">
                    <td className="px-5 py-4 text-neutral-700">{action.business_id ?? '—'}</td>
                    <td className="px-5 py-4">
                      <div>
                        <Link
                          href={`/dashboard/acoes/${action.id}`}
                          className="font-medium text-neutral-900 hover:text-brand-700"
                        >
                          {action.title}
                        </Link>
                        <p className="mt-1 text-xs text-neutral-400">
                          Atualizado em {formatDate(action.updated_at)}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {projectMap.get(action.project_id) ?? 'Projeto vinculado'}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {action.assigned_to
                        ? responsibleMap.get(action.assigned_to) ?? 'Responsável vinculado'
                        : 'Não definido'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`badge ${ACTION_STATUS_COLORS[action.status]}`}>
                        {ACTION_STATUS_LABELS[action.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`badge ${ACTION_PRIORITY_COLORS[action.priority]}`}>
                        {ACTION_PRIORITY_LABELS[action.priority]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {formatDate(action.due_date)}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {formatDate(action.completion_date)}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {(() => {
                        const progress = calculateActionStepProgress(stepsByAction.get(action.id) ?? [])
                        return (
                          <div className="min-w-[140px]">
                            <div className="flex items-center justify-between text-xs">
                              <span>{progress.completed}/{progress.total} etapas</span>
                              <span>{progress.percentage}%</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                              <div
                                className="h-full rounded-full bg-brand-600"
                                style={{ width: `${progress.percentage}%` }}
                              />
                            </div>
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/acoes/${action.id}`} className="btn-ghost">
                          Ver
                        </Link>
                        <Link href={`/dashboard/acoes/${action.id}/editar`} className="btn-secondary">
                          Editar
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
