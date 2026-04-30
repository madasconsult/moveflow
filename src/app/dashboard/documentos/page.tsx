import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getActiveProjectContext } from '@/lib/active-project/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { DocumentsWorkspace } from '@/components/documents/DocumentsWorkspace'
import { ActiveProjectEmptyState } from '@/components/projects/ActiveProjectEmptyState'
import type { Document, DocumentFolder, Project, Profile } from '@/types/database.types'

export const metadata: Metadata = { title: 'Documentos' }

type DocumentListItem = Pick<
  Document,
  | 'id'
  | 'project_id'
  | 'folder_id'
  | 'document_name'
  | 'category'
  | 'responsible_id'
  | 'status'
  | 'visibility'
  | 'updated_at'
>

type FolderLookup = Pick<DocumentFolder, 'id' | 'project_id' | 'folder_name' | 'parent_folder_id'>
type ProjectLookup = Pick<Project, 'id' | 'project_name'>
type ResponsibleLookup = Pick<Profile, 'id' | 'full_name'>

export default async function DocumentsPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const activeProjectContext = await getActiveProjectContext(session.profile)
  const activeProjectId = activeProjectContext.activeProjectId

  if (!activeProjectId) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Documentos</h1>
            <p className="page-subtitle">
              Organize documentos por pastas dentro do projeto ativo.
            </p>
          </div>
        </div>
        <ActiveProjectEmptyState />
      </div>
    )
  }

  const supabase = await createClient()
  const [{ data: documentsData }, { data: foldersData }, { data: projectsData }] = await Promise.all([
    supabase
      .from('documents')
      .select('id, project_id, folder_id, document_name, category, responsible_id, status, visibility, updated_at')
      .eq('project_id', activeProjectId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('document_folders')
      .select('id, project_id, folder_name, parent_folder_id')
      .eq('project_id', activeProjectId)
      .order('folder_name'),
    supabase
      .from('projects')
      .select('id, project_name')
      .eq('id', activeProjectId)
      .order('project_name'),
  ])

  const documents: DocumentListItem[] = (documentsData as DocumentListItem[] | null) ?? []
  const folders: FolderLookup[] = (foldersData as FolderLookup[] | null) ?? []
  const projects: ProjectLookup[] = (projectsData as ProjectLookup[] | null) ?? []

  const responsibleIds = Array.from(
    new Set(documents.map(document => document.responsible_id).filter(Boolean) as string[])
  )

  const responsiblesRes = responsibleIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', responsibleIds)
    : { data: [] as ResponsibleLookup[] | null }

  const responsibleMap = new Map(
    (((responsiblesRes.data as ResponsibleLookup[] | null) ?? [])).map(profile => [profile.id, profile.full_name])
  )
  const projectMap = new Map(projects.map(project => [project.id, project.project_name]))

  const rows = documents.map(document => ({
    ...document,
    responsible_name: document.responsible_id
      ? responsibleMap.get(document.responsible_id) ?? 'Responsável vinculado'
      : null,
    project_name: projectMap.get(document.project_id) ?? 'Projeto vinculado',
  }))

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Documentos</h1>
          <p className="page-subtitle">
            Organize documentos do projeto ativo: {activeProjectContext.activeProject?.project_name}.
          </p>
        </div>
        {session.profile.role === 'admin_faus' && (
          <Link href="/dashboard/documentos/novo" className="btn-primary">
            <Plus size={16} />
            Novo documento
          </Link>
        )}
      </div>

      {rows.length === 0 && folders.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
          <FileText size={36} className="mb-4 text-neutral-300" />
          <h2 className="text-base font-semibold text-neutral-900">Nenhum documento disponível</h2>
          <p className="mt-1 max-w-md text-sm text-neutral-500">
            Nenhum registro encontrado para este projeto.
          </p>
          {session.profile.role === 'admin_faus' && (
            <Link href="/dashboard/documentos/novo" className="btn-primary mt-5">
              <Plus size={16} />
              Criar primeiro documento
            </Link>
          )}
        </div>
      ) : (
        <DocumentsWorkspace
          documents={rows}
          folders={folders}
          projects={projects}
          isAdmin={session.profile.role === 'admin_faus'}
        />
      )}
    </div>
  )
}
