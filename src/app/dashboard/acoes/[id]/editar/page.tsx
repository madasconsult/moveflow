import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { ActionForm } from '@/components/actions/ActionForm'
import type { Action, Profile, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Editar Ação' }

interface PageProps {
  params: { id: string }
}

type ProjectOption = Pick<Project, 'id' | 'project_name'>
type ResponsibleOption = Pick<Profile, 'id' | 'full_name'>

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

  const isAdmin = session.profile.role === 'admin_faus'

  const [projectsRes, responsiblesRes] = await Promise.all([
    isAdmin
      ? supabase.from('projects').select('id, project_name').order('project_name')
      : supabase.from('projects').select('id, project_name').eq('id', action.project_id),
    isAdmin
      ? supabase
          .from('profiles')
          .select('id, full_name')
          .in('role', ['admin_faus', 'consultor_faus'])
          .eq('is_active', true)
          .order('full_name')
      : action.assigned_to && action.assigned_to !== session.profile.id
        ? supabase.from('profiles').select('id, full_name').in('id', [session.profile.id, action.assigned_to])
        : Promise.resolve({
            data: [{ id: session.profile.id, full_name: session.profile.full_name }] as ResponsibleOption[] | null,
          }),
  ])

  const projects: ProjectOption[] = (projectsRes.data as ProjectOption[] | null) ?? []
  const responsibles: ResponsibleOption[] = (responsiblesRes.data as ResponsibleOption[] | null) ?? []

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Editar ação</h1>
        <p className="page-subtitle">
          Ajuste responsável, prioridade, status e visibilidade da ação vinculada ao projeto.
        </p>
      </div>

      <ActionForm
        mode="edit"
        initialData={action}
        projects={projects}
        responsibles={responsibles}
        canChooseProject={isAdmin}
      />
    </div>
  )
}
