import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { DiaryEntryForm } from '@/components/diary/DiaryEntryForm'
import { getActiveProjectContext } from '@/lib/active-project/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import type { DiaryDeliverable, DiaryEntry, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Editar Diário de Bordo' }

interface PageProps {
  params: { id: string }
}

export default async function EditDiaryEntryPage({ params }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const supabase = await createClient()
  const [entryRes, deliverablesRes, activeProjectContext] = await Promise.all([
    supabase
      .from('diary_entries')
      .select('*')
      .eq('id', params.id)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('diary_deliverables')
      .select('id, diary_entry_id, description, position, created_at')
      .eq('diary_entry_id', params.id)
      .order('position', { ascending: true }),
    getActiveProjectContext(session.profile),
  ])

  const entry = (entryRes.data as DiaryEntry | null) ?? null
  if (!entry) notFound()

  const deliverables = (deliverablesRes.data as DiaryDeliverable[] | null) ?? []
  const projectRes = await supabase
    .from('projects')
    .select('id, main_consultant_id')
    .eq('id', entry.project_id)
    .single()
  const project = (projectRes.data as Pick<Project, 'id' | 'main_consultant_id'> | null) ?? null
  const canManageDiary =
    session.profile.role === 'admin_faus' ||
    (session.profile.role === 'consultor_faus' && project?.main_consultant_id === session.profile.id)

  if (!canManageDiary) redirect('/unauthorized?reason=forbidden')

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Editar Diário de Bordo</h1>
        <p className="page-subtitle">
          Ajuste período, pessoas FAUS e entregáveis registrados nesta visita/semana.
        </p>
      </div>

      <DiaryEntryForm
        mode="edit"
        projects={activeProjectContext.projects}
        activeProjectId={activeProjectContext.activeProjectId}
        canChooseProject={false}
        initialData={entry}
        initialDeliverables={deliverables}
      />
    </div>
  )
}
