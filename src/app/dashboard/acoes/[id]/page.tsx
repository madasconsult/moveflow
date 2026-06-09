import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CheckSquare, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import {
  ACTION_CLASSIFICATION_LABELS,
  ACTION_PRIORITY_COLORS,
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_CARD_COLORS,
  ACTION_STATUS_COLORS,
  ACTION_STATUS_LABELS,
  cn,
  formatDate,
} from '@/lib/utils'
import { ActionStepsManager } from '@/components/actions/ActionStepsManager'
import { MarkActionCompletedButton } from '@/components/actions/MarkActionCompletedButton'
import type { Action, ActionAssignee, ActionStep, Profile, Project, ProjectExternalStakeholder } from '@/types/database.types'

export const metadata: Metadata = { title: 'Detalhe da Ação' }

interface PageProps {
  params: { id: string }
  searchParams?: { returnTo?: string }
}

function getSafeReturnTo(raw: string | undefined): string {
  if (!raw) return '/dashboard/acoes'
  try {
    const decoded = decodeURIComponent(raw)
    if (decoded.startsWith('/dashboard/acoes')) return decoded
  } catch {
    // invalid encoding — fall through
  }
  return '/dashboard/acoes'
}

type ProjectPermissionLookup = Pick<Project, 'id' | 'project_name' | 'main_consultant_id'>
type ResponsibleLookup = Pick<Profile, 'id' | 'full_name' | 'email'>

export default async function ActionDetailPage({ params, searchParams }: PageProps) {
  const backUrl = getSafeReturnTo(searchParams?.returnTo)
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const supabase = await createClient()
  const { data } = await supabase
    .from('actions')
    .select('*')
    .eq('id', params.id)
    .single()

  const action = (data as Action | null) ?? null

  if (!action) notFound()

  const [projectRes, assigneesRes, stepsRes, externalLinksRes] = await Promise.all([
    supabase.from('projects').select('id, project_name, main_consultant_id').eq('id', action.project_id).single(),
    supabase
      .from('action_assignees' as any)
      .select('user_id')
      .eq('action_id', action.id),
    supabase
      .from('action_steps')
      .select('*')
      .eq('action_id', action.id)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
    (supabase.from('action_external_stakeholders') as any)
      .select('stakeholder_id')
      .eq('action_id', action.id),
  ])

  const project    = (projectRes.data as ProjectPermissionLookup | null) ?? null
  const actionSteps = (stepsRes.data as ActionStep[] | null) ?? []
  const assigneeRows = (assigneesRes.data as Pick<ActionAssignee, 'user_id'>[] | null) ?? []

  // IDs dos responsáveis: prioriza action_assignees, fallback em assigned_to
  const assigneeIds: string[] =
    assigneeRows.length > 0
      ? assigneeRows.map(r => r.user_id)
      : action.assigned_to
        ? [action.assigned_to]
        : []

  // IDs de envolvidos externos vinculados a esta ação
  const externalStakeholderIds: string[] =
    ((externalLinksRes.data as { stakeholder_id: string }[] | null) ?? []).map(r => r.stakeholder_id)

  // Busca perfis dos responsáveis e dados dos envolvidos externos em paralelo
  const [responsiblesRaw, externalStakeholdersRaw] = await Promise.all([
    assigneeIds.length > 0
      ? supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', assigneeIds)
          .order('full_name')
      : Promise.resolve({ data: [] as ResponsibleLookup[] | null }),
    externalStakeholderIds.length > 0
      ? (supabase.from('project_external_stakeholders') as any)
          .select('id, name, role_title, email, phone')
          .in('id', externalStakeholderIds)
          .order('name')
      : Promise.resolve({ data: [] as ProjectExternalStakeholder[] | null }),
  ])

  const responsibles: ResponsibleLookup[] =
    (responsiblesRaw.data as ResponsibleLookup[] | null) ?? []

  const externalStakeholders: Pick<ProjectExternalStakeholder, 'id' | 'name' | 'role_title' | 'email' | 'phone'>[] =
    (externalStakeholdersRaw.data as ProjectExternalStakeholder[] | null) ?? []

  const canManageAction =
    session.profile.role === 'admin_faus' ||
    (session.profile.role === 'consultor_faus' && project?.main_consultant_id === session.profile.id)

  return (
    <div className="space-y-6">
      <div className="page-header flex-col !items-stretch gap-4 lg:flex-row lg:!items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">{action.title}</h1>
            <span className={cn('badge', ACTION_STATUS_COLORS[action.status])}>
              {ACTION_STATUS_LABELS[action.status]}
            </span>
          </div>
          <p className="page-subtitle">
            Visão simples da ação, responsáveis, prazo e visibilidade no portal do cliente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Link href={backUrl} className="btn-secondary h-10 shrink-0 whitespace-nowrap px-4">
            Voltar
          </Link>
          {canManageAction && (
            <>
              <Link
                href={`/dashboard/fsps/novo?sourceType=action&actionId=${action.id}`}
                className="btn-secondary h-10 shrink-0 whitespace-nowrap px-4"
              >
                Abrir FSP
              </Link>
              <Link href={`/dashboard/acoes/${action.id}/editar`} className="btn-primary h-10 shrink-0 whitespace-nowrap px-4">
                <Pencil size={16} />
                Editar ação
              </Link>
              <MarkActionCompletedButton
                actionId={action.id}
                isCompleted={action.status === 'completed'}
                containerClassName="w-full sm:w-auto sm:min-w-[220px]"
                buttonClassName="h-10 whitespace-nowrap px-4 !bg-green-600 !text-white hover:!bg-green-700 focus:!ring-green-500 disabled:!bg-green-100 disabled:!text-green-700"
              />
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className={cn('card border-l-4 p-6 space-y-6', ACTION_STATUS_CARD_COLORS[action.status])}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2">
                <CheckSquare size={16} className="text-neutral-400" />
                <span className={cn('badge', ACTION_STATUS_COLORS[action.status])}>
                  {ACTION_STATUS_LABELS[action.status]}
                </span>
              </div>
              <h2 className="text-2xl font-semibold leading-tight text-neutral-950 md:text-3xl">
                {action.title}
              </h2>
              <p className="mt-2 text-sm font-medium text-neutral-500">
                {action.business_id ?? 'Sem ID de negócio'}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="mb-1 text-xs text-neutral-400">Projeto</p>
              <p className="text-sm text-neutral-800">{project?.project_name ?? 'Projeto vinculado'}</p>
            </div>

            {/* Responsáveis internos — múltiplos com fallback */}
            <div>
              <p className="mb-1 text-xs text-neutral-400">
                {responsibles.length > 1 ? 'Responsáveis' : 'Responsável'}
              </p>
              {responsibles.length === 0 ? (
                <p className="text-sm text-neutral-800">Nenhum responsável definido</p>
              ) : (
                <ul className="space-y-1">
                  {responsibles.map(r => (
                    <li key={r.id}>
                      <p className="text-sm text-neutral-800">{r.full_name}</p>
                      {r.email && (
                        <p className="text-xs text-neutral-400">{r.email}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Participantes do Cliente (envolvidos externos) */}
            <div>
              <p className="mb-1 text-xs text-neutral-400">Participantes do Cliente</p>
              {externalStakeholders.length === 0 ? (
                <p className="text-sm text-neutral-800">Nenhum participante registrado</p>
              ) : (
                <ul className="space-y-1">
                  {externalStakeholders.map(s => (
                    <li key={s.id}>
                      <p className="text-sm text-neutral-800">{s.name}</p>
                      {s.role_title && (
                        <p className="text-xs text-neutral-400">{s.role_title}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-1 text-xs text-neutral-400">Prazo</p>
              <p className="text-sm text-neutral-800">{formatDate(action.due_date)}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-neutral-400">Prioridade</p>
              <span className={cn('badge', ACTION_PRIORITY_COLORS[action.priority])}>
                {ACTION_PRIORITY_LABELS[action.priority]}
              </span>
            </div>
            <div>
              <p className="mb-1 text-xs text-neutral-400">Classificação</p>
              <p className="text-sm text-neutral-800">
                {ACTION_CLASSIFICATION_LABELS[action.classification]}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs text-neutral-400">Data de conclusão</p>
              <p className="text-sm text-neutral-800">
                {action.completion_date ? formatDate(action.completion_date) : 'Ainda não concluída'}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs text-neutral-400">Visibilidade</p>
              <p className="text-sm text-neutral-800">
                {action.visible_to_client ? 'Portal do cliente' : 'Uso interno'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Descrição</p>
            <p className="whitespace-pre-wrap text-base leading-relaxed text-neutral-800">
              {action.description ?? 'Nenhuma descrição registrada.'}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Observações internas</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
              {action.notes ?? 'Nenhuma observação registrada.'}
            </p>
          </div>
        </div>

        <ActionStepsManager
          actionId={action.id}
          actionStatus={action.status}
          actionCompletionDate={action.completion_date}
          initialSteps={actionSteps}
          canEdit={canManageAction}
        />
      </div>
    </div>
  )
}
