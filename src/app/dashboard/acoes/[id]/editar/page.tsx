import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { getActiveProjectContext } from '@/lib/active-project/server'
import { ActionForm } from '@/components/actions/ActionForm'
import type { Action, ActionAssignee, Profile, Project, UserRole } from '@/types/database.types'

export const metadata: Metadata = { title: 'Editar Ação' }

interface PageProps {
  params: { id: string }
}

interface ProjectOption {
  id: string
  project_name: string
  client_id: string
}

type ResponsibleOption = Pick<Profile, 'id' | 'full_name'>
type ProjectPermissionLookup = Pick<Project, 'id' | 'project_name' | 'main_consultant_id'> & { client_id: string }
const RESPONSIBLE_ROLES: UserRole[] = ['admin_faus', 'gestor_faus', 'consultor_faus']

export default async function EditActionPage({ params }: PageProps) {
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

  const projectPermissionRes = await supabase
    .from('projects')
    .select('id, project_name, client_id, main_consultant_id')
    .eq('id', action.project_id)
    .single()

  const projectPermission = (projectPermissionRes.data as ProjectPermissionLookup | null) ?? null
  const isAdmin = session.profile.role === 'admin_faus'
  const isLeadConsultant =
    session.profile.role === 'consultor_faus' &&
    projectPermission?.main_consultant_id === session.profile.id

  if (!isAdmin && !isLeadConsultant) redirect('/unauthorized?reason=forbidden')

  const [projectsRes, responsiblesRes, assigneesRes, activeProjectContext] = await Promise.all([
    isAdmin
      ? supabase.from('projects').select('id, project_name, client_id').order('project_name')
      : Promise.resolve({ data: projectPermission ? [projectPermission] : [] as ProjectOption[] | null }),
    isAdmin || isLeadConsultant
      ? supabase
          .from('profiles')
          .select('id, full_name')
          .in('role', RESPONSIBLE_ROLES)
          .eq('is_active', true)
          .order('full_name')
      : action.assigned_to && action.assigned_to !== session.profile.id
        ? supabase.from('profiles').select('id, full_name').in('id', [session.profile.id, action.assigned_to])
        : Promise.resolve({
            data: [{ id: session.profile.id, full_name: session.profile.full_name }] as ResponsibleOption[] | null,
          }),
    supabase
      .from('action_assignees' as any)
      .select('user_id')
      .eq('action_id', action.id),
    getActiveProjectContext(session.profile),
  ])

  const projects: ProjectOption[]         = (projectsRes.data as ProjectOption[] | null) ?? []
  const responsibles: ResponsibleOption[] = (responsiblesRes.data as ResponsibleOption[] | null) ?? []
  const assigneeRows                       = (assigneesRes.data as Pick<ActionAssignee, 'user_id'>[] | null) ?? []

  const initialAssigneeIds: string[] =
    assigneeRows.length > 0
      ? assigneeRows.map(r => r.user_id)
      : action.assigned_to
        ? [action.assigned_to]
        : []

  const activeClientId   = activeProjectContext.activeProject?.client_id ?? null
  const activeClientName = activeProjectContext.activeProject?.client_name ?? null

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Editar ação</h1>
        <p className="page-subtitle">
          Ajuste responsáveis, prioridade, status e visibilidade da ação vinculada ao projeto.
        </p>
      </div>

      <ActionForm
        mode="edit"
        initialData={action}
        projects={projects}
        responsibles={responsibles}
        canChooseProject={isAdmin}
        initialAssigneeIds={initialAssigneeIds}
        isAdmin={isAdmin}
        activeClientId={activeClientId}
        activeClientName={activeClientName}
      />
    </div>
  )
}
