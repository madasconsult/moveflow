import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getActiveProjectContext } from '@/lib/active-project/server'
import { canAccessReports } from '@/lib/reports'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { ActiveProjectEmptyState } from '@/components/projects/ActiveProjectEmptyState'
import { ReportCenterClient } from '@/components/reports/ReportCenterClient'

export const metadata: Metadata = { title: 'Central de Relatórios' }

export default async function ReportsPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (!canAccessReports(session.profile)) redirect('/unauthorized?reason=forbidden')

  const activeProjectContext = await getActiveProjectContext(session.profile)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Central de Relatórios</h1>
          <p className="page-subtitle">
            Gere PDFs executivos do projeto ativo, sem IA, com dados reais de ações e reuniões.
          </p>
        </div>
      </div>

      {!activeProjectContext.activeProject ? (
        <ActiveProjectEmptyState description="Selecione um projeto ativo para gerar relatórios deste módulo." />
      ) : (
        <ReportCenterClient
          activeProject={activeProjectContext.activeProject}
          canUseAiBriefing={session.profile.role === 'admin_faus'}
        />
      )}
    </div>
  )
}
