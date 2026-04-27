import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CheckSquare, FolderKanban, Pencil, UserCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import {
  ACTION_CLASSIFICATION_LABELS,
  ACTION_PRIORITY_COLORS,
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_COLORS,
  ACTION_STATUS_LABELS,
  FSP_STATUS_COLORS,
  FSP_STATUS_LABELS,
  cn,
  formatDate,
} from '@/lib/utils'
import { MarkActionCompletedButton } from '@/components/actions/MarkActionCompletedButton'
import type { Action, Fsp, Kpi, Meeting, Profile, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Detalhe da Ação' }

interface PageProps {
  params: { id: string }
}

type ProjectLookup = Pick<Project, 'id' | 'project_name'>
type ResponsibleLookup = Pick<Profile, 'id' | 'full_name' | 'email'>
type MeetingLookup = Pick<Meeting, 'id' | 'meeting_date'>
type FspLookup = Pick<Fsp, 'id' | 'title' | 'status' | 'kpi_id'>
type KpiLookup = Pick<Kpi, 'id' | 'kpi_name'>

export default async function ActionDetailPage({ params }: PageProps) {
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

  const [projectRes, responsibleRes, meetingRes, fspRes, kpiRes] = await Promise.all([
    supabase.from('projects').select('id, project_name').eq('id', action.project_id).single(),
    action.assigned_to
      ? supabase.from('profiles').select('id, full_name, email').eq('id', action.assigned_to).single()
      : Promise.resolve({ data: null }),
    action.related_meeting_id
      ? supabase.from('meetings').select('id, meeting_date').eq('id', action.related_meeting_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('fsps')
      .select('id, title, status, kpi_id')
      .or(`action_id.eq.${action.id},linked_action_id.eq.${action.id},generated_action_id.eq.${action.id}`),
    action.kpi_id
      ? supabase.from('kpis').select('id, kpi_name').eq('id', action.kpi_id).single()
      : Promise.resolve({ data: null }),
  ])

  const project = (projectRes.data as ProjectLookup | null) ?? null
  const responsible = (responsibleRes.data as ResponsibleLookup | null) ?? null
  const relatedMeeting = (meetingRes.data as MeetingLookup | null) ?? null
  const relatedFsps = (fspRes.data as FspLookup[] | null) ?? []
  const relatedKpi = (kpiRes.data as KpiLookup | null) ?? null

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">{action.title}</h1>
            <span className={cn('badge', ACTION_STATUS_COLORS[action.status])}>
              {ACTION_STATUS_LABELS[action.status]}
            </span>
          </div>
          <p className="page-subtitle">
            Visão simples da ação, responsável, prazo e visibilidade no portal do cliente.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/acoes" className="btn-secondary">
            Voltar
          </Link>
          <Link href={`/dashboard/fsps/novo?sourceType=action&actionId=${action.id}`} className="btn-secondary">
            Abrir FSP
          </Link>
          <Link href={`/dashboard/acoes/${action.id}/editar`} className="btn-primary">
            <Pencil size={16} />
            Editar ação
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CheckSquare size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Contexto da ação</h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-neutral-400">ID da ação</p>
                <p className="text-sm font-medium text-neutral-900">{action.business_id ?? 'Sem ID de negócio'}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Projeto</p>
                <p className="text-sm text-neutral-800">{project?.project_name ?? 'Projeto vinculado'}</p>
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
              <div className="md:col-span-2">
                <p className="mb-1 text-xs text-neutral-400">Descrição</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                  {action.description ?? 'Nenhuma descrição registrada.'}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="mb-1 text-xs text-neutral-400">Observações internas</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                  {action.notes ?? 'Nenhuma observação registrada.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <UserCircle2 size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Responsável</h2>
            </div>

            {responsible ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-900">{responsible.full_name}</p>
                <p className="text-sm text-neutral-500">{responsible.email}</p>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Nenhum responsável definido.</p>
            )}
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CheckSquare size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Conclusão da ação</h2>
            </div>

            <div className="space-y-3 text-sm text-neutral-700">
              <p>
                {action.status === 'completed'
                  ? 'Esta ação já está concluída.'
                  : 'Use a ação abaixo para registrar formalmente a conclusão desta atividade.'}
              </p>
              <MarkActionCompletedButton actionId={action.id} isCompleted={action.status === 'completed'} />
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FolderKanban size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Relacionamentos</h2>
            </div>

            <div className="space-y-3 text-sm text-neutral-700">
              <div>
                <p className="mb-1 text-xs text-neutral-400">Visível no cliente</p>
                <p>{action.visible_to_client ? 'Sim, disponível no portal do cliente.' : 'Não, uso interno apenas.'}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Reunião relacionada</p>
                {relatedMeeting ? (
                  <Link href={`/dashboard/reunioes/${relatedMeeting.id}`} className="text-brand-600 hover:text-brand-700">
                    Ver reunião de {formatDate(relatedMeeting.meeting_date)}
                  </Link>
                ) : (
                  <p>Nenhuma reunião relacionada.</p>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">KPI relacionado</p>
                {relatedKpi ? (
                  <Link href={`/dashboard/kpis/${relatedKpi.id}`} className="text-brand-600 hover:text-brand-700">
                    {relatedKpi.kpi_name}
                  </Link>
                ) : (
                  <p>Nenhum KPI relacionado.</p>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">FSPs relacionadas</p>
                {relatedFsps.length > 0 ? (
                  <div className="space-y-2">
                    {relatedFsps.map(fsp => (
                      <div key={fsp.id} className="flex items-center gap-2">
                        <Link href={`/dashboard/fsps/${fsp.id}`} className="text-brand-600 hover:text-brand-700">
                          {fsp.title}
                        </Link>
                        <span className={cn('badge', FSP_STATUS_COLORS[fsp.status])}>
                          {FSP_STATUS_LABELS[fsp.status]}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>Nenhuma FSP relacionada.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
