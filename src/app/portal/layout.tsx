import { redirect } from 'next/navigation'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { PortalSidebar } from '@/components/layout/PortalSidebar'
import { PortalHeader } from '@/components/layout/PortalHeader'
import { AuthProvider } from '@/components/auth/AuthProvider'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile')       redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive')         redirect('/unauthorized?reason=inactive')

  const { profile } = session

  if (profile.role !== 'cliente') redirect('/dashboard')

  return (
    <AuthProvider profile={profile}>
      <div className="dashboard-shell flex h-screen overflow-hidden">
        <PortalSidebar profile={profile} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <PortalHeader profile={profile} />
          <main className="flex-1 overflow-y-auto px-6 py-7 animate-page lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  )
}
