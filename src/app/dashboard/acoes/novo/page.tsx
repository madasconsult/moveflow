import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { getActiveProjectContext } from '@/lib/active-project/server'
import { ActionForm } from '@/components/actions/ActionForm'
import type { Profile, ProjectExternalStakeholder, UserRole } from '@/types/database.types'

export const metadata: Metadata = { title: 'Nova Ação' }

interface ProjectOption {
  id: string
  project_name: string
  client_id: string
}

type ResponsibleOption = Pick<Profile, 'id' | 'full_name'>
const RESPONSIBLE_ROLES: UserRole[] = ['admin_faus', 'gestor_faus', 'consultor_faus']

export default async function NewActionPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (!['admin_faus', 'consultor_faus'].includes(session.profile.role)) {
    redirect('/unauthorized?reason=forbidden')
  }

  const supabase = await createClient()
  const isAdmin = session.profile.role === 'admin_faus'

  const [projectsRes, responsiblesRes, activeProjectContext] = await Promise.all([
    isAdmin
      ? supabase.from('projects').select('id, project_name, client_id').order('project_name')
      : supabase
          .from('projects')
          .select('id, project_name, client_id')
          .eq('main_consultant_id', session.profile.id)
          .order('project_name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', RESPONSIBLE_ROLES)
      .eq('is_active', true)
      .order('full_name'),
    getActiveProjectContext(session.profile),
  ])

  const projects: ProjectOption[] = (projectsRes.data as ProjectOption[] | null) ?? []
  const responsibles: ResponsibleOption[] = (responsiblesRes.data as ResponsibleOption[] | null) ?? []

  const activeProjectId   = activeProjectContext.activeProjectId
  const activeProjectName = activeProjectContext.activeProject?.project_name ?? null
  const activeClientId    = activeProjectContext.activeProject?.client_id ?? null
  const activeClientName  = activeProjectContext.activeProject?.client_name ?? null

  // Non-admin só pode escolher projeto se não houver filtro ativo.
  const canChooseProject = isAdmin || !activeProjectId

  // Busca envolvidos externos ativos do projeto ativo (para seleção no formulário)
  const projectStakeholders: ProjectExternalStakeholder[] = activeProjectId
    ? ((await (supabase.from('project_external_stakeholders') as any)
        .select('id, project_id, name, role_title, email, phone, is_active, created_at, created_by')
        .eq('project_id', activeProjectId)
        .eq('is_active', true)
        .order('name')).data as ProjectExternalStakeholder[] | null) ?? []
    : []

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Nova ação</h1>
        <p className="page-subtitle">
          Registre uma nova ação operacional com projeto, responsável, prioridade e visibilidade.
        </p>
      </div>

      <ActionForm
        mode="create"
        projects={projects}
        responsibles={responsibles}
        canChooseProject={canChooseProject}
        isAdmin={isAdmin}
        activeProjectId={activeProjectId}
        activeProjectName={activeProjectName}
        activeClientId={activeClientId}
        activeClientName={activeClientName}
        projectStakeholders={projectStakeholders}
      />
    </div>
  )
}
