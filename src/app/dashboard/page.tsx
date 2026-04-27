import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'
import { DashboardHome } from '@/components/layout/DashboardHome'
import type { Action, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')

  const { profile } = session
  const supabase = await createClient()

  // Estatísticas básicas para o dashboard inicial
  // Admin vê todos; consultor vê apenas seus projetos via RLS
  const [projectsRes, actionsRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id, project_name, status, phase, progress_percentage, client_id', { count: 'exact' }),
    supabase
      .from('actions')
      .select('id, status, due_date', { count: 'exact' })
      .in('status', ['not_started', 'in_progress', 'waiting_client', 'waiting_faus', 'overdue']),
  ])

  const projects: Project[] = (projectsRes.data as Project[] | null) ?? []
  const totalProjects = projectsRes.count ?? 0

  const actions: Action[] = (actionsRes.data as Action[] | null) ?? []
  const overdueActions = actions.filter(a => a.status === 'overdue').length
  const waitingClient  = actions.filter(a => a.status === 'waiting_client').length

  const activeProjects = projects.filter(p =>
    ['in_progress', 'at_risk', 'delayed'].includes(p.status)
  ).length

  return (
    <DashboardHome
      profile={profile}
      stats={{
        totalProjects,
        activeProjects,
        pendingActions: actions.length,
        overdueActions,
        waitingClient,
      }}
      recentProjects={projects.slice(0, 5)}
    />
  )
}
