import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { ProjectForm } from '@/components/projects/ProjectForm'
import type { Client, Profile, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Editar Projeto' }

interface PageProps {
  params: { id: string }
}

type ClientOption = Pick<Client, 'id' | 'company_name'>
type ConsultantOption = Pick<Profile, 'id' | 'full_name'>

export default async function EditProjectPage({ params }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const supabase = await createClient()
  const { data: projectData } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single()

  const project = (projectData as Project | null) ?? null

  if (!project) notFound()

  const isAdmin = session.profile.role === 'admin_faus'

  const [clientsRes, consultantsRes] = await Promise.all([
    isAdmin
      ? supabase.from('clients').select('id, company_name').order('company_name')
      : supabase.from('clients').select('id, company_name').eq('id', project.client_id),
    isAdmin
      ? supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'consultor_faus')
          .eq('is_active', true)
          .order('full_name')
      : project.main_consultant_id
        ? supabase.from('profiles').select('id, full_name').eq('id', project.main_consultant_id)
        : Promise.resolve({ data: [] as ConsultantOption[] | null }),
  ])

  const clients: ClientOption[] = (clientsRes.data as ClientOption[] | null) ?? []
  const consultants: ConsultantOption[] = (consultantsRes.data as ConsultantOption[] | null) ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="page-title">Editar projeto</h1>
        <p className="page-subtitle">
          Ajuste o projeto mantendo o vínculo real com cliente, consultor e bloco estratégico.
        </p>
      </div>

      <ProjectForm
        mode="edit"
        initialData={project}
        clients={clients}
        consultants={consultants}
        isAdmin={isAdmin}
      />
    </div>
  )
}
