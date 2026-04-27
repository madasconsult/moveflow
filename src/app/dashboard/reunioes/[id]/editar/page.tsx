import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { MeetingForm } from '@/components/meetings/MeetingForm'
import type { Meeting, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Editar Reunião' }

interface PageProps {
  params: { id: string }
}

type ProjectOption = Pick<Project, 'id' | 'project_name'>

export default async function EditMeetingPage({ params }: PageProps) {
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

  const isAdmin = session.profile.role === 'admin_faus'
  const projectsRes = isAdmin
    ? await supabase.from('projects').select('id, project_name').order('project_name')
    : await supabase.from('projects').select('id, project_name').eq('id', meeting.project_id)

  const projects: ProjectOption[] = (projectsRes.data as ProjectOption[] | null) ?? []

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Editar reunião</h1>
        <p className="page-subtitle">
          Atualize a reunião mantendo projeto, resumo executivo, decisões e próximos passos.
        </p>
      </div>

      <MeetingForm
        mode="edit"
        initialData={meeting}
        projects={projects}
        canChooseProject={isAdmin}
      />
    </div>
  )
}
