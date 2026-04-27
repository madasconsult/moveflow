import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { MeetingForm } from '@/components/meetings/MeetingForm'
import type { Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Nova Reunião' }

type ProjectOption = Pick<Project, 'id' | 'project_name'>

export default async function NewMeetingPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role !== 'admin_faus') redirect('/unauthorized?reason=forbidden')

  const supabase = await createClient()
  const projectsRes = await supabase.from('projects').select('id, project_name').order('project_name')
  const projects: ProjectOption[] = (projectsRes.data as ProjectOption[] | null) ?? []

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Nova reunião</h1>
        <p className="page-subtitle">
          Registre o encontro do projeto com data, resumo executivo, decisões e próximos passos.
        </p>
      </div>

      <MeetingForm
        mode="create"
        projects={projects}
        canChooseProject
      />
    </div>
  )
}
