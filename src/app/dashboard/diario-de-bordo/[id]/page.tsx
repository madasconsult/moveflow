import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowRightFromLine, BookOpenText, CalendarDays, CheckCircle2, Pencil, Users } from 'lucide-react'
import { DeleteDiaryEntryButton } from '@/components/diary/DeleteDiaryEntryButton'
import {
  DELIVERABLE_STATUS_CLASSES,
  DELIVERABLE_STATUS_LABELS,
  formatDiaryDate,
  formatDiaryPeriod,
  getDeliverableStatusKey,
} from '@/lib/diary-board'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import type { DiaryDeliverable, DiaryEntry, Profile, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Detalhe do Diário de Bordo' }

interface PageProps {
  params: { id: string }
}

type ProjectLookup = Pick<Project, 'id' | 'project_name' | 'client_id' | 'main_consultant_id'> & {
  clients: { company_name: string | null } | { company_name: string | null }[] | null
}
type CreatorLookup = Pick<Profile, 'id' | 'full_name' | 'email'>

interface DeliverableSummary {
  total: number
  new_count: number
  carried: number
  completed: number
  partial: number
  pending: number
}

function StatusBadge({ status }: { status: string | null }) {
  const key = getDeliverableStatusKey(status)
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DELIVERABLE_STATUS_CLASSES[key]}`}>
      {DELIVERABLE_STATUS_LABELS[key]}
    </span>
  )
}

function SummaryCard({ summary }: { summary: DeliverableSummary }) {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={16} className="text-neutral-400" />
        <h2 className="text-sm font-semibold text-neutral-900">Resumo de entregáveis</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-neutral-50 p-3 text-center">
          <p className="text-2xl font-semibold text-neutral-900">{summary.total}</p>
          <p className="mt-0.5 text-xs text-neutral-500">Total</p>
        </div>
        <div className="rounded-xl bg-neutral-50 p-3 text-center">
          <p className="text-2xl font-semibold text-neutral-700">{summary.new_count}</p>
          <p className="mt-0.5 text-xs text-neutral-500">Novos</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-center">
          <p className="text-2xl font-semibold text-amber-700">{summary.carried}</p>
          <p className="mt-0.5 text-xs text-amber-600">Herdados</p>
        </div>
        <div className="rounded-xl bg-green-50 p-3 text-center">
          <p className="text-2xl font-semibold text-green-700">{summary.completed}</p>
          <p className="mt-0.5 text-xs text-green-600">Realizados</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-center">
          <p className="text-2xl font-semibold text-amber-700">{summary.partial}</p>
          <p className="mt-0.5 text-xs text-amber-600">Parciais</p>
        </div>
        <div className="rounded-xl bg-red-50 p-3 text-center">
          <p className="text-2xl font-semibold text-red-700">{summary.pending}</p>
          <p className="mt-0.5 text-xs text-red-600">Pendentes</p>
        </div>
      </div>
    </div>
  )
}

export default async function DiaryEntryDetailPage({ params }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const supabase = await createClient()
  const { data } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single()

  const entry = (data as DiaryEntry | null) ?? null
  if (!entry) notFound()

  const [projectRes, deliverablesRes, creatorRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id, project_name, client_id, main_consultant_id, clients(company_name)')
      .eq('id', entry.project_id)
      .single(),
    supabase
      .from('diary_deliverables')
      .select('id, diary_entry_id, description, position, created_at, status, completion_date, notes, origin_deliverable_id, carried_from_diary_entry_id, is_carried_over')
      .eq('diary_entry_id', entry.id)
      .order('position', { ascending: true }),
    entry.created_by
      ? supabase.from('profiles').select('id, full_name, email').eq('id', entry.created_by).single()
      : Promise.resolve({ data: null }),
  ])

  const project = (projectRes.data as unknown as ProjectLookup | null) ?? null
  const client = Array.isArray(project?.clients) ? project?.clients[0] : project?.clients
  const deliverables = (deliverablesRes.data as DiaryDeliverable[] | null) ?? []
  const creator = (creatorRes.data as CreatorLookup | null) ?? null

  // Fetch origin entry titles for carried-over deliverables
  const carriedFromIds = Array.from(
    new Set(
      deliverables
        .filter(d => d.carried_from_diary_entry_id)
        .map(d => d.carried_from_diary_entry_id as string)
    )
  )
  const originEntryTitles = new Map<string, string>()
  if (carriedFromIds.length > 0) {
    const { data: originEntries } = await supabase
      .from('diary_entries')
      .select('id, title')
      .in('id', carriedFromIds)
    ;(originEntries ?? []).forEach((e: { id: string; title: string }) => {
      originEntryTitles.set(e.id, e.title)
    })
  }

  const isAdmin = session.profile.role === 'admin_faus'
  const canManageDiary =
    isAdmin ||
    (session.profile.role === 'consultor_faus' && project?.main_consultant_id === session.profile.id)

  // Build summary
  const summary: DeliverableSummary = {
    total: deliverables.length,
    new_count: deliverables.filter(d => !d.is_carried_over).length,
    carried: deliverables.filter(d => d.is_carried_over).length,
    completed: deliverables.filter(d => d.status === 'completed').length,
    partial: deliverables.filter(d => d.status === 'partial').length,
    pending: deliverables.filter(d => d.status === 'pending').length,
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">{entry.title}</h1>
          <p className="page-subtitle">
            Registro oficial de dedicação e entregáveis da FAUS no projeto.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard/diario-de-bordo" className="btn-secondary">
            Voltar
          </Link>
          {canManageDiary && (
            <Link href={`/dashboard/diario-de-bordo/${entry.id}/editar`} className="btn-primary">
              <Pencil size={16} />
              Editar
            </Link>
          )}
          {isAdmin && <DeleteDiaryEntryButton entryId={entry.id} />}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-2">
              <BookOpenText size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Contexto da visita</h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-neutral-400">Cliente</p>
                <p className="text-sm text-neutral-800">{client?.company_name ?? 'Cliente vinculado'}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Projeto</p>
                <p className="text-sm text-neutral-800">{project?.project_name ?? 'Projeto vinculado'}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Período</p>
                <p className="text-sm text-neutral-800">{formatDiaryPeriod(entry.start_date, entry.end_date)}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Criado em</p>
                <p className="text-sm text-neutral-800">{formatDiaryDate(entry.created_at)}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Criado por</p>
                <p className="text-sm text-neutral-800">{creator?.full_name ?? 'Não informado'}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Entregáveis</p>
                <p className="text-sm text-neutral-800">{deliverables.length}</p>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Entregáveis da semana</h2>
            </div>

            {deliverables.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhum entregável registrado.</p>
            ) : (
              <div className="space-y-3">
                {deliverables.map((deliverable, index) => {
                  const statusKey = getDeliverableStatusKey(deliverable.status)
                  const originTitle = deliverable.carried_from_diary_entry_id
                    ? originEntryTitles.get(deliverable.carried_from_diary_entry_id)
                    : null

                  return (
                    <div key={deliverable.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                          Entregável {index + 1}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {deliverable.is_carried_over && (
                            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                              <ArrowRightFromLine size={10} />
                              herdado
                            </span>
                          )}
                          <StatusBadge status={deliverable.status} />
                        </div>
                      </div>

                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                        {deliverable.description}
                      </p>

                      {deliverable.is_carried_over && originTitle && (
                        <p className="text-xs text-amber-600">
                          Origem: {originTitle}
                        </p>
                      )}

                      {deliverable.status === 'completed' && deliverable.completion_date && (
                        <p className="text-xs text-green-700">
                          Realizado em {formatDiaryDate(deliverable.completion_date)}
                        </p>
                      )}

                      {(deliverable.status === 'partial' || deliverable.status === 'pending') && deliverable.notes && (
                        <div className="rounded-lg bg-white border border-neutral-100 px-3 py-2">
                          <p className="text-xs font-medium text-neutral-400 mb-0.5">Observação</p>
                          <p className="text-xs text-neutral-600 whitespace-pre-wrap">{deliverable.notes}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Pessoas FAUS envolvidas</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {entry.faus_people.map(person => (
                <span key={person} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                  {person}
                </span>
              ))}
            </div>
          </div>

          <SummaryCard summary={summary} />

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Resumo executivo</h2>
            </div>
            <p className="text-sm leading-relaxed text-neutral-600">
              Este registro consolida a dedicação da FAUS entre {formatDiaryPeriod(entry.start_date, entry.end_date)}
              {' '}e mantém os entregáveis estruturados para acompanhamento executivo futuro.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
