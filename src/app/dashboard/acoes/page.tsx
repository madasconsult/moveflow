import type { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, CheckSquare, Plus, Rows4, Workflow } from 'lucide-react'
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
import { ActionCalendarView } from '@/components/actions/ActionCalendarView'
import type { Action, ActionStep, ActionStatus, Project, Profile } from '@/types/database.types'

export const metadata: Metadata = { title: 'Ações' }

// ── Tipos locais ──────────────────────────────────────────────────────────────

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

type ProjectPermissionLookup = Pick<Project, 'id' | 'main_consultant_id'>
type ProfileLookup           = Pick<Profile, 'id' | 'full_name'>
type StepLookup              = Pick<ActionStep, 'action_id' | 'status'>

type ViewType = 'list' | 'pipeline' | 'calendar'

// ── Labels do Pipeline ────────────────────────────────────────────────────────

const ACTION_PIPELINE_STATUS_LABELS = {
  overdue_pipeline: 'Atrasadas',
  ...ACTION_STATUS_LABELS,
}

const ACTION_PIPELINE_STATUS_COLORS = {
  overdue_pipeline: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  ...ACTION_STATUS_COLORS,
}

// ── Opções de filtro de prazo ─────────────────────────────────────────────────

const DUE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',         label: 'Qualquer prazo' },
  { value: 'overdue',     label: 'Vencidas' },
  { value: 'today',       label: 'Vencem hoje' },
  { value: 'next_7',      label: 'Próximos 7 dias' },
  { value: 'next_30',     label: 'Próximos 30 dias' },
  { value: 'no_due_date', label: 'Sem prazo' },
]

// ── Props da página ───────────────────────────────────────────────────────────

interface ActionsPageProps {
  searchParams?: {
    view?: string
    status?: string
    assignee?: string
    due?: string
    month?: string
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseView(raw: string | undefined): ViewType {
  if (raw === 'pipeline') return 'pipeline'
  if (raw === 'calendar') return 'calendar'
  return 'list'
}

function parseMonth(raw: string | undefined): { year: number; month: number; param: string } {
  const today = new Date()
  const fy    = today.getFullYear()
  const fm    = today.getMonth() + 1
  const fp    = `${fy}-${String(fm).padStart(2, '0')}`

  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return { year: fy, month: fm, param: fp }

  const [ys, ms] = raw.split('-')
  const year  = parseInt(ys, 10)
  const month = parseInt(ms, 10)
  if (!year || month < 1 || month > 12) return { year: fy, month: fm, param: fp }
  return { year, month, param: raw }
}

function applyFilters(
  actions: ActionListItem[],
  statusFilter: string,
  dueFilter: string,
  assigneeFilter: string,
): ActionListItem[] {
  let result = actions

  if (statusFilter) {
    result = result.filter(a => a.status === statusFilter)
  }

  if (dueFilter && dueFilter !== 'all') {
    const today    = new Date()
    const pad      = (n: number) => String(n).padStart(2, '0')
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
    const future   = (days: number) => {
      const d = new Date(today)
      d.setDate(d.getDate() + days)
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }

    switch (dueFilter) {
      case 'overdue':
        result = result.filter(a =>
          a.due_date &&
          a.due_date.slice(0, 10) < todayStr &&
          a.status !== 'completed' &&
          !a.completion_date,
        )
        break
      case 'today':
        result = result.filter(a => a.due_date?.slice(0, 10) === todayStr)
        break
      case 'next_7':
        result = result.filter(a =>
          a.due_date &&
          a.due_date.slice(0, 10) >= todayStr &&
          a.due_date.slice(0, 10) <= future(7),
        )
        break
      case 'next_30':
        result = result.filter(a =>
          a.due_date &&
          a.due_date.slice(0, 10) >= todayStr &&
          a.due_date.slice(0, 10) <= future(30),
        )
        break
      case 'no_due_date':
        result = result.filter(a => !a.due_date)
        break
    }
  }

  if (assigneeFilter) {
    result = assigneeFilter === 'none'
      ? result.filter(a => !a.assigned_to)
      : result.filter(a => a.assigned_to === assigneeFilter)
  }

  return result
}

function buildFilterBase(s: string, d: string, a: string): string {
  const p = new URLSearchParams()
  if (s)                    p.set('status',   s)
  if (d && d !== 'all')     p.set('due',      d)
  if (a)                    p.set('assignee', a)
  return p.toString()
}

// ── Página ────────────────────────────────────────────────────────────────────

export default async function ActionsPage({ searchParams }: ActionsPageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile')      redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive')        redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente')   redirect('/portal')

  const view           = parseView(searchParams?.view)
  const statusFilter   = searchParams?.status   ?? ''
  const assigneeFilter = searchParams?.assignee ?? ''
  const dueFilter      = searchParams?.due      ?? 'all'
  const { year, month, param: monthParam } = parseMonth(searchParams?.month)

  const activeProjectContext = await getActiveProjectContext(session.profile)
  const activeProjectId      = activeProjectContext.activeProjectId

  if (!activeProjectId) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Ações</h1>
            <p className="page-subtitle">
              Acompanhe ações por tabela, pipeline ou calendário, com filtros por prazo, status e responsável.
            </p>
          </div>
        </div>
        <ActiveProjectEmptyState />
      </div>
    )
  }

  const supabase = await createClient()

  // 1. Todas as ações do projeto (sem filtros de UI)
  const actionsRes = await supabase
    .from('actions')
    .select(
      'id, business_id, project_id, title, assigned_to, status, priority, due_date, completion_date, visible_to_client, updated_at',
    )
    .eq('project_id', activeProjectId)
    .order('due_date', { ascending: true, nullsFirst: false })

  const allActions: ActionListItem[] = (actionsRes.data as ActionListItem[] | null) ?? []

  // 2. IDs de responsáveis de TODAS as ações (para o dropdown)
  const allResponsibleIds = Array.from(
    new Set(allActions.map(a => a.assigned_to).filter(Boolean) as string[]),
  )

  // 3. Paralelo: permissão + responsáveis para dropdown
  const [activeProjectRes, allResponsiblesRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id, main_consultant_id')
      .eq('id', activeProjectId)
      .single(),
    allResponsibleIds.length > 0
      ? supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', allResponsibleIds)
          .order('full_name')
      : Promise.resolve({ data: [] as ProfileLookup[] | null }),
  ])

  const activeProject   = (activeProjectRes.data as ProjectPermissionLookup | null) ?? null
  const allResponsibles = (allResponsiblesRes.data as ProfileLookup[] | null) ?? []

  const canCreateAction =
    session.profile.role === 'admin_faus' ||
    (session.profile.role === 'consultor_faus' &&
      activeProject?.main_consultant_id === session.profile.id)

  // 4. Aplica filtros
  const actions = applyFilters(allActions, statusFilter, dueFilter, assigneeFilter)

  // 5. Mapa de responsáveis (conjunto total — funciona para todas as views)
  const responsibleMap = new Map(allResponsibles.map(p => [p.id, p.full_name]))

  // 6. Steps das ações filtradas
  const stepsRes = actions.length > 0
    ? await supabase
        .from('action_steps')
        .select('action_id, status')
        .in('action_id', actions.map(a => a.id))
    : { data: [] as StepLookup[] | null }

  const stepsByAction = new Map<string, StepLookup[]>()
  ;((stepsRes.data as StepLookup[] | null) ?? []).forEach(step => {
    stepsByAction.set(step.action_id, [
      ...(stepsByAction.get(step.action_id) ?? []),
      step,
    ])
  })

  // 7. Estado dos filtros
  const filterBase       = buildFilterBase(statusFilter, dueFilter, assigneeFilter)
  const hasActiveFilters = Boolean(
    statusFilter || (dueFilter && dueFilter !== 'all') || assigneeFilter,
  )

  // 8. returnTo encodado para links de ação
  const currentReturnTo = encodeURIComponent(
    `/dashboard/acoes?view=${view}${view === 'calendar' ? `&month=${monthParam}` : ''}${filterBase ? `&${filterBase}` : ''}`,
  )

  // 9. Colunas do pipeline
  const pipelineColumns = groupActionsByStatus(sortActionsByDueDate(actions)).map(col => ({
    status:  col.status,
    label:   ACTION_PIPELINE_STATUS_LABELS[col.status],
    actions: col.actions,
  }))

  // 10. Status options para o filtro
  const statusOptions = Object.entries(ACTION_STATUS_LABELS) as [ActionStatus, string][]

  // URL de troca de visão preservando filtros
  function viewHref(target: ViewType): string {
    const calMonth = target === 'calendar' ? `&month=${monthParam}` : ''
    const filters  = filterBase ? `&${filterBase}` : ''
    return `/dashboard/acoes?view=${target}${calMonth}${filters}`
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Ações</h1>
          <p className="page-subtitle">
            Acompanhe ações por tabela, pipeline ou calendário no projeto ativo:{' '}
            {activeProjectContext.activeProject?.project_name}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={viewHref('list')} className={view === 'list' ? 'btn-primary' : 'btn-secondary'}>
            <Rows4 size={16} />
            Lista
          </Link>
          <Link href={viewHref('pipeline')} className={view === 'pipeline' ? 'btn-primary' : 'btn-secondary'}>
            <Workflow size={16} />
            Pipeline
          </Link>
          <Link href={viewHref('calendar')} className={view === 'calendar' ? 'btn-primary' : 'btn-secondary'}>
            <Calendar size={16} />
            Calendário
          </Link>
          {canCreateAction && (
            <Link href="/dashboard/acoes/novo" className="btn-primary">
              <Plus size={16} />
              Nova ação
            </Link>
          )}
        </div>
      </div>

      {/* Barra de filtros */}
      <form method="GET" className="card p-4">
        <input type="hidden" name="view" value={view} />
        {view === 'calendar' && <input type="hidden" name="month" value={monthParam} />}
        <div className="flex flex-wrap items-end gap-4">

          {/* Prazo */}
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-due" className="text-xs font-medium text-neutral-500">
              Prazo
            </label>
            <select
              id="filter-due"
              name="due"
              defaultValue={dueFilter}
              className="input w-auto py-1.5 text-sm"
            >
              {DUE_FILTER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-status" className="text-xs font-medium text-neutral-500">
              Status
            </label>
            <select
              id="filter-status"
              name="status"
              defaultValue={statusFilter}
              className="input w-auto py-1.5 text-sm"
            >
              <option value="">Todos os status</option>
              {statusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Responsável */}
          {allResponsibles.length > 0 && (
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-assignee" className="text-xs font-medium text-neutral-500">
                Responsável
              </label>
              <select
                id="filter-assignee"
                name="assignee"
                defaultValue={assigneeFilter}
                className="input w-auto py-1.5 text-sm"
              >
                <option value="">Todos</option>
                <option value="none">Sem responsável</option>
                {allResponsibles.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Ações do filtro */}
          <div className="flex items-center gap-3 pb-0.5">
            <button type="submit" className="btn-secondary py-1.5 text-sm">
              Aplicar
            </button>
            {hasActiveFilters && (
              <>
                <Link
                  href={`/dashboard/acoes?view=${view}${view === 'calendar' ? `&month=${monthParam}` : ''}`}
                  className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
                >
                  Limpar filtros
                </Link>
                <span className="text-xs text-neutral-400">
                  {actions.length} de {allActions.length} ações
                </span>
              </>
            )}
          </div>
        </div>
      </form>

      {/* ── Visão Calendário ─────────────────────────────────────────────── */}
      {view === 'calendar' && (
        <ActionCalendarView
          actions={actions}
          responsibleMap={responsibleMap}
          year={year}
          month={month}
          filterBase={filterBase}
          returnTo={currentReturnTo}
        />
      )}

      {/* ── Visão Pipeline ───────────────────────────────────────────────── */}
      {view === 'pipeline' && (
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
                      const steps              = stepsByAction.get(action.id) ?? []
                      const progress           = calculateActionStepProgress(steps)
                      const progressPercentage = getActionProgressPercent(action, steps)
                      const overdue            = isActionOverdue(action)

                      return (
                        <Link
                          key={action.id}
                          href={`/dashboard/acoes/${action.id}?returnTo=${currentReturnTo}`}
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
                          <p className="mt-2 text-sm font-semibold leading-snug text-neutral-900">
                            {action.title}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {action.assigned_to
                              ? (responsibleMap.get(action.assigned_to) ?? 'Responsável vinculado')
                              : 'Responsável não definido'}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className={`badge ${ACTION_STATUS_COLORS[action.status]}`}>
                              {ACTION_STATUS_LABELS[action.status]}
                            </span>
                            <span className={`badge ${ACTION_PRIORITY_COLORS[action.priority]}`}>
                              {ACTION_PRIORITY_LABELS[action.priority]}
                            </span>
                            <span
                              className={`badge ${
                                overdue
                                  ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200'
                                  : 'bg-neutral-100 text-neutral-600'
                              }`}
                            >
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
      )}

      {/* ── Visão Lista/Tabela ───────────────────────────────────────────── */}
      {view === 'list' && (
        actions.length === 0 ? (
          <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
            <CheckSquare size={36} className="mb-4 text-neutral-300" />
            <h2 className="text-base font-semibold text-neutral-900">Nenhuma ação disponível</h2>
            <p className="mt-1 max-w-md text-sm text-neutral-500">
              {hasActiveFilters
                ? 'Nenhuma ação corresponde aos filtros selecionados.'
                : 'Nenhum registro encontrado para este projeto.'}
            </p>
            {canCreateAction && !hasActiveFilters && (
              <Link href="/dashboard/acoes/novo" className="btn-primary mt-5">
                <Plus size={16} />
                Criar primeira ação
              </Link>
            )}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    <th className="px-5 py-3">ID</th>
                    <th className="px-5 py-3">Título</th>
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
                            href={`/dashboard/acoes/${action.id}?returnTo=${currentReturnTo}`}
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
                        {action.assigned_to
                          ? (responsibleMap.get(action.assigned_to) ?? 'Responsável vinculado')
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
                      <td className="px-5 py-4 text-neutral-600">{formatDate(action.due_date)}</td>
                      <td className="px-5 py-4 text-neutral-600">{formatDate(action.completion_date)}</td>
                      <td className="px-5 py-4 text-neutral-600">
                        {(() => {
                          const prog = calculateActionStepProgress(stepsByAction.get(action.id) ?? [])
                          return (
                            <div className="min-w-[140px]">
                              <div className="flex items-center justify-between text-xs">
                                <span>{prog.completed}/{prog.total} etapas</span>
                                <span>{prog.percentage}%</span>
                              </div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                                <div
                                  className="h-full rounded-full bg-brand-600"
                                  style={{ width: `${prog.percentage}%` }}
                                />
                              </div>
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/acoes/${action.id}?returnTo=${currentReturnTo}`}
                            className="btn-ghost"
                          >
                            Ver
                          </Link>
                          {canCreateAction && (
                            <Link
                              href={`/dashboard/acoes/${action.id}/editar`}
                              className="btn-secondary"
                            >
                              Editar
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
