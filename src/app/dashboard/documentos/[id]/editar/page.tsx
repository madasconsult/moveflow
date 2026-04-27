import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { DocumentForm } from '@/components/documents/DocumentForm'
import type { Document, DocumentFolder, Profile, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Editar Documento' }

interface PageProps {
  params: { id: string }
}

type ProjectOption = Pick<Project, 'id' | 'project_name'>
type ResponsibleOption = Pick<Profile, 'id' | 'full_name'>
type FolderOption = Pick<DocumentFolder, 'id' | 'project_id' | 'folder_name'>

export default async function EditDocumentPage({ params }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const supabase = await createClient()
  const { data } = await supabase
    .from('documents')
    .select('*')
    .eq('id', params.id)
    .single()

  const document = (data as Document | null) ?? null

  if (!document) notFound()

  const isAdmin = session.profile.role === 'admin_faus'

  const [projectsRes, responsiblesRes, foldersRes] = await Promise.all([
    isAdmin
      ? supabase.from('projects').select('id, project_name').order('project_name')
      : supabase.from('projects').select('id, project_name').eq('id', document.project_id),
    isAdmin
      ? supabase
          .from('profiles')
          .select('id, full_name')
          .in('role', ['admin_faus', 'consultor_faus'])
          .eq('is_active', true)
          .order('full_name')
      : document.responsible_id && document.responsible_id !== session.profile.id
        ? supabase.from('profiles').select('id, full_name').in('id', [session.profile.id, document.responsible_id])
        : Promise.resolve({
            data: [{ id: session.profile.id, full_name: session.profile.full_name }] as ResponsibleOption[] | null,
          }),
    supabase
      .from('document_folders')
      .select('id, project_id, folder_name')
      .eq('project_id', document.project_id)
      .order('folder_name'),
  ])

  const projects: ProjectOption[] = (projectsRes.data as ProjectOption[] | null) ?? []
  const responsibles: ResponsibleOption[] = (responsiblesRes.data as ResponsibleOption[] | null) ?? []
  const folders: FolderOption[] = (foldersRes.data as FolderOption[] | null) ?? []

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Editar documento</h1>
        <p className="page-subtitle">
          Atualize nome, categoria, status, descrição e visibilidade do documento.
        </p>
      </div>

      <DocumentForm
        mode="edit"
        initialData={document}
        projects={projects}
        responsibles={responsibles}
        folders={folders}
        canChooseProject={isAdmin}
      />
    </div>
  )
}
