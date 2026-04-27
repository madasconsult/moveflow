import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { DocumentForm } from '@/components/documents/DocumentForm'
import type { DocumentFolder, Profile, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Novo Documento' }

type ProjectOption = Pick<Project, 'id' | 'project_name'>
type ResponsibleOption = Pick<Profile, 'id' | 'full_name'>
type FolderOption = Pick<DocumentFolder, 'id' | 'project_id' | 'folder_name'>

export default async function NewDocumentPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role !== 'admin_faus') redirect('/unauthorized?reason=forbidden')

  const supabase = await createClient()
  const [projectsRes, responsiblesRes, foldersRes] = await Promise.all([
    supabase.from('projects').select('id, project_name').order('project_name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['admin_faus', 'consultor_faus'])
      .eq('is_active', true)
      .order('full_name'),
    supabase.from('document_folders').select('id, project_id, folder_name').order('folder_name'),
  ])

  const projects: ProjectOption[] = (projectsRes.data as ProjectOption[] | null) ?? []
  const responsibles: ResponsibleOption[] = (responsiblesRes.data as ResponsibleOption[] | null) ?? []
  const folders: FolderOption[] = (foldersRes.data as FolderOption[] | null) ?? []

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Novo documento</h1>
        <p className="page-subtitle">
          Cadastre um documento vinculando projeto, categoria, visibilidade e link existente.
        </p>
      </div>

      <DocumentForm
        mode="create"
        projects={projects}
        responsibles={responsibles}
        folders={folders}
        canChooseProject
      />
    </div>
  )
}
