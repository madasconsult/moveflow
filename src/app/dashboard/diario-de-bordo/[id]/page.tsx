import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { BookOpenText, CalendarDays, CheckCircle2, Pencil, Users } from 'lucide-react'
import { DeleteDiaryEntryButton } from '@/components/diary/DeleteDiaryEntryButton'
import { formatDiaryDate, formatDiaryPeriod } from '@/lib/diary-board'
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
      .select('id, diary_entry_id, description, position, created_at')
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
  const isAdmin = session.profile.role === 'admin_faus'
  const canManageDiary =
    isAdmin ||
    (session.profile.role === 'consultor_faus' && project?.main_consultant_id === session.profile.id)

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

            <div className="space-y-3">
              {deliverables.map((deliverable, index) => (
                <div key={deliverable.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                    Entregável {index + 1}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                    {deliverable.description}
                  </p>
                </div>
              ))}
            </div>
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
