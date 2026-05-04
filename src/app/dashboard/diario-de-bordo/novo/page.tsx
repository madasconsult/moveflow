import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { DiaryEntryForm } from '@/components/diary/DiaryEntryForm'
import { getActiveProjectContext } from '@/lib/active-project/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'

export const metadata: Metadata = { title: 'Registrar Dedicação' }

export default async function NewDiaryEntryPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const activeProjectContext = await getActiveProjectContext(session.profile)

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Registrar Dedicação</h1>
        <p className="page-subtitle">
          Informe o período da visita/semana, pessoas FAUS envolvidas e entregáveis realizados.
        </p>
      </div>

      <DiaryEntryForm
        mode="create"
        projects={activeProjectContext.projects}
        activeProjectId={activeProjectContext.activeProjectId}
        canChooseProject={!activeProjectContext.activeProjectId}
      />
    </div>
  )
}
