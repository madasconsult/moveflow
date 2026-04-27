import { redirect } from 'next/navigation'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { getHomeRouteForRole } from '@/lib/supabase/auth'

// A rota raiz apenas redireciona — middleware já faz isso,
// mas este fallback garante SSR correto
export default async function RootPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') {
    redirect('/login')
  }

  if (session.status === 'no_profile') {
    redirect('/unauthorized?reason=no_profile')
  }

  if (session.status === 'inactive') {
    redirect('/unauthorized?reason=inactive')
  }

  redirect(getHomeRouteForRole(session.profile.role))
}
