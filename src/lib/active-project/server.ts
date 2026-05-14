import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_PROJECT_COOKIE } from '@/lib/active-project/constants'
import { canAccessPortal, canViewAllProjects } from '@/lib/utils'
import type { Profile } from '@/types/database.types'

export interface ActiveProjectOption {
  id: string
  project_name: string
  client_id: string
  client_name: string | null
}

export interface ActiveProjectContext {
  projects: ActiveProjectOption[]
  activeProjectId: string | null
  activeProject: ActiveProjectOption | null
}

interface ProjectWithClient {
  id: string
  project_name: string
  client_id: string
  main_consultant_id: string | null
  clients: { company_name: string | null } | { company_name: string | null }[] | null
}

export async function getActiveProjectContext(profile: Profile): Promise<ActiveProjectContext> {
  const supabase = await createClient()
  const [projectsRes, membershipsRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id, project_name, client_id, main_consultant_id, clients(company_name)')
      .order('project_name', { ascending: true }),
    profile.role === 'consultor_faus'
      ? supabase.from('project_members').select('project_id').eq('user_id', profile.id)
      : Promise.resolve({ data: [] as { project_id: string }[] | null, error: null }),
  ])

  if (projectsRes.error) {
    throw new Error(`Não foi possível carregar projetos acessíveis: ${projectsRes.error.message}`)
  }

  if (membershipsRes.error) {
    throw new Error(`Não foi possível carregar vínculos de projeto: ${membershipsRes.error.message}`)
  }

  const membershipProjectIds = new Set(
    (((membershipsRes.data as { project_id: string }[] | null) ?? [])).map(member => member.project_id)
  )
  const accessibleProjects = ((projectsRes.data as unknown as ProjectWithClient[] | null) ?? []).filter(project => {
    if (canViewAllProjects(profile.role)) return true
    if (canAccessPortal(profile.role)) return Boolean(profile.client_id) && project.client_id === profile.client_id
    return project.main_consultant_id === profile.id || membershipProjectIds.has(project.id)
  })

  const projects = accessibleProjects.map(project => {
    const client = Array.isArray(project.clients) ? project.clients[0] : project.clients

    return {
      id: project.id,
      project_name: project.project_name,
      client_id: project.client_id,
      client_name: client?.company_name ?? null,
    }
  })

  const cookieProjectId = cookies().get(ACTIVE_PROJECT_COOKIE)?.value ?? null
  const cookieProject = cookieProjectId
    ? projects.find(project => project.id === cookieProjectId) ?? null
    : null
  const activeProject = cookieProject ?? (projects.length === 1 ? projects[0] : null)

  return {
    projects,
    activeProjectId: activeProject?.id ?? null,
    activeProject,
  }
}
