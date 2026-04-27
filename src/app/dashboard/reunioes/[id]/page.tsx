import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarDays, FolderKanban, Pencil } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import {
  MEETING_TYPE_COLORS,
  MEETING_TYPE_LABELS,
  cn,
  formatDateTime,
} from '@/lib/utils'
import type { Meeting, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Detalhe da Reunião' }

interface PageProps {
  params: { id: string }
}

type ProjectLookup = Pick<Project, 'id' | 'project_name'>

export default async function MeetingDetailPage({ params }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const supabase = await createClient()
  const { data } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', params.id)
    .single()

  const meeting = (data as Meeting | null) ?? null

  if (!meeting) notFound()

  const projectRes = await supabase
    .from('projects')
    .select('id, project_name')
    .eq('id', meeting.project_id)
    .single()

  const project = (projectRes.data as ProjectLookup | null) ?? null

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">{MEETING_TYPE_LABELS[meeting.meeting_type]}</h1>
            <span className={cn('badge', MEETING_TYPE_COLORS[meeting.meeting_type])}>
              {MEETING_TYPE_LABELS[meeting.meeting_type]}
            </span>
          </div>
          <p className="page-subtitle">
            Visão simples da reunião, projeto vinculado e principais decisões registradas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reunioes" className="btn-secondary">
            Voltar
          </Link>
          <Link href={`/dashboard/reunioes/${meeting.id}/editar`} className="btn-primary">
            <Pencil size={16} />
            Editar reunião
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Resumo da reunião</h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-neutral-400">Projeto</p>
                <p className="text-sm text-neutral-800">{project?.project_name ?? 'Projeto vinculado'}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Data e hora</p>
                <p className="text-sm text-neutral-800">{formatDateTime(meeting.meeting_date)}</p>
              </div>
              <div className="md:col-span-2">
                <p className="mb-1 text-xs text-neutral-400">Participantes</p>
                {meeting.participants && meeting.participants.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {meeting.participants.map(participant => (
                      <span key={participant} className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">
                        {participant}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-700">Nenhum participante registrado.</p>
                )}
              </div>
              <div className="md:col-span-2">
                <p className="mb-1 text-xs text-neutral-400">Resumo executivo</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                  {meeting.executive_summary ?? 'Nenhum resumo executivo registrado.'}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="mb-1 text-xs text-neutral-400">Decisões tomadas</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                  {meeting.decisions_made ?? 'Nenhuma decisão registrada.'}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="mb-1 text-xs text-neutral-400">Próximos passos</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                  {meeting.next_steps ?? 'Nenhum próximo passo registrado.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FolderKanban size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Visibilidade</h2>
            </div>

            <div className="space-y-3 text-sm text-neutral-700">
              <div>
                <p className="mb-1 text-xs text-neutral-400">Portal do cliente</p>
                <p>{meeting.visible_to_client ? 'Visível para o cliente.' : 'Registro interno apenas.'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
