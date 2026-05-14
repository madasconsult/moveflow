import { redirect } from 'next/navigation'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { getActiveProjectContext } from '@/lib/active-project/server'
import { canAccessPortal } from '@/lib/utils'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile')       redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive')         redirect('/unauthorized?reason=inactive')

  const { profile } = session

  if (canAccessPortal(profile.role)) redirect('/portal')

  const activeProjectContext = await getActiveProjectContext(profile)

  return (
    <AuthProvider profile={profile}>
      <div className="dashboard-shell flex h-screen overflow-hidden">
        <Sidebar profile={profile} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header
            profile={profile}
            projects={activeProjectContext.projects}
            activeProjectId={activeProjectContext.activeProjectId}
          />
          <main className="flex-1 overflow-y-auto px-6 py-7 animate-page lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  )
}
