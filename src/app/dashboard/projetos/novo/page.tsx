import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { ProjectForm } from '@/components/projects/ProjectForm'
import type { Client, Profile, UserRole } from '@/types/database.types'

export const metadata: Metadata = { title: 'Novo Projeto' }

type ClientOption = Pick<Client, 'id' | 'company_name'>
type ConsultantOption = Pick<Profile, 'id' | 'full_name'>
type ProjectManagerOption = Pick<Profile, 'id' | 'full_name'>

const INTERNAL_CONSULTANT_ROLES: UserRole[] = ['admin_faus', 'gestor_faus', 'consultor_faus']
const PROJECT_MANAGER_ROLES: UserRole[] = ['admin_faus', 'gestor_faus']

export default async function NewProjectPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')
  if (session.profile.role === 'gestor_faus') redirect('/unauthorized?reason=forbidden')

  const isAdmin = session.profile.role === 'admin_faus'
  const supabase = await createClient()

  const [clientsRes, consultantsRes, managersRes] = await Promise.all([
    supabase.from('clients').select('id, company_name').order('company_name'),
    isAdmin
      ? supabase
          .from('profiles')
          .select('id, full_name')
          .in('role', INTERNAL_CONSULTANT_ROLES)
          .eq('is_active', true)
          .order('full_name')
      : Promise.resolve({
          data: [
            { id: session.profile.id, full_name: session.profile.full_name },
          ] as ConsultantOption[],
        }),
    isAdmin
      ? supabase
          .from('profiles')
          .select('id, full_name')
          .in('role', PROJECT_MANAGER_ROLES)
          .eq('is_active', true)
          .order('full_name')
      : Promise.resolve({ data: [] as ProjectManagerOption[] }),
  ])

  const clients: ClientOption[] = (clientsRes.data as ClientOption[] | null) ?? []
  const consultants: ConsultantOption[] = (consultantsRes.data as ConsultantOption[] | null) ?? []
  const projectManagers: ProjectManagerOption[] = (managersRes.data as ProjectManagerOption[] | null) ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="page-title">Novo projeto</h1>
        <p className="page-subtitle">
          Configure o projeto com vínculo ao cliente e bloco estratégico obrigatório desde o início.
        </p>
      </div>

      <ProjectForm
        mode="create"
        clients={clients}
        consultants={consultants}
        projectManagers={projectManagers}
        isAdmin={isAdmin}
        currentUserId={session.profile.id}
      />
    </div>
  )
}
