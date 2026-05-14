import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { DiaryEntryForm } from '@/components/diary/DiaryEntryForm'
import { getActiveProjectContext } from '@/lib/active-project/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'

export const metadata: Metadata = { title: 'Registrar Dedicação' }

interface ProjectWithClient {
  id: string
  project_name: string
  client_id: string
  clients: { company_name: string | null } | { company_name: string | null }[] | null
}

export default async function NewDiaryEntryPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')
  if (session.profile.role === 'gestor_faus') redirect('/unauthorized?reason=forbidden')

  const activeProjectContext = await getActiveProjectContext(session.profile)
  const supabase = await createClient()
  const leadProjectsRes =
    session.profile.role === 'consultor_faus'
      ? await supabase
          .from('projects')
          .select('id, project_name, client_id, clients(company_name)')
          .eq('main_consultant_id', session.profile.id)
          .order('project_name')
      : null
  const leadProjects = ((leadProjectsRes?.data as unknown as ProjectWithClient[] | null) ?? []).map(project => {
    const client = Array.isArray(project.clients) ? project.clients[0] : project.clients
    return {
      id: project.id,
      project_name: project.project_name,
      client_id: project.client_id,
      client_name: client?.company_name ?? null,
    }
  })
  const projects = session.profile.role === 'consultor_faus' ? leadProjects : activeProjectContext.projects
  const activeProjectId =
    session.profile.role === 'consultor_faus' &&
    activeProjectContext.activeProjectId &&
    leadProjects.some(project => project.id === activeProjectContext.activeProjectId)
      ? activeProjectContext.activeProjectId
      : session.profile.role === 'consultor_faus'
        ? null
        : activeProjectContext.activeProjectId

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Registrar Dedicação</h1>
        <p className="page-subtitle">
          Informe o período da visita/semana, pessoas FAUS envolvidas e entregáveis realizados.
        </p>
      </div>

      <DiaryEntryForm
        mode="create"
        projects={projects}
        activeProjectId={activeProjectId}
        canChooseProject={!activeProjectId}
      />
    </div>
  )
}
