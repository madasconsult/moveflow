'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { FolderPlus, Loader2, PencilLine } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_STATUS_COLORS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_VISIBILITY_COLORS,
  DOCUMENT_VISIBILITY_LABELS,
  formatDate,
} from '@/lib/utils'

interface FolderRow {
  id: string
  project_id: string
  folder_name: string
  parent_folder_id: string | null
}

interface DocumentRow {
  id: string
  project_id: string
  folder_id: string | null
  document_name: string
  category: string
  responsible_name: string | null
  project_name: string
  status: string
  visibility: string
  updated_at: string
}

interface ProjectRow {
  id: string
  project_name: string
}

interface DocumentsWorkspaceProps {
  documents: DocumentRow[]
  folders: FolderRow[]
  projects: ProjectRow[]
  isAdmin: boolean
}

export function DocumentsWorkspace({
  documents,
  folders,
  projects,
  isAdmin,
}: DocumentsWorkspaceProps) {
  const router = useRouter()
  const supabase = createClient()
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all')
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderProjectId, setNewFolderProjectId] = useState(projects[0]?.id ?? '')
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameFolderName, setRenameFolderName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const filteredDocuments = useMemo(() => {
    if (selectedFolderId === 'all') return documents
    if (selectedFolderId === 'none') return documents.filter(document => !document.folder_id)
    return documents.filter(document => document.folder_id === selectedFolderId)
  }, [documents, selectedFolderId])

  async function handleCreateFolder() {
    if (!isAdmin || !newFolderName.trim() || !newFolderProjectId) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: authData } = await supabase.auth.getUser()
      const { error: insertError } = await (supabase.from('document_folders') as any)
        .insert({
          project_id: newFolderProjectId,
          folder_name: newFolderName.trim(),
          parent_folder_id: null,
          created_by: authData.user?.id ?? null,
        })

      if (insertError) throw new Error(insertError.message)

      setNewFolderName('')
      setSuccess('Pasta criada com sucesso.')
      router.refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Não foi possível criar a pasta.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRenameFolder(folderId: string) {
    if (!isAdmin || !renameFolderName.trim()) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await (supabase.from('document_folders') as any)
        .update({ folder_name: renameFolderName.trim() })
        .eq('id', folderId)

      if (updateError) throw new Error(updateError.message)

      setRenamingFolderId(null)
      setRenameFolderName('')
      setSuccess('Pasta renomeada com sucesso.')
      router.refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Não foi possível renomear a pasta.')
    } finally {
      setSaving(false)
    }
  }

  async function handleMoveDocument(documentId: string, folderId: string) {
    if (!isAdmin) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await (supabase.from('documents') as any)
        .update({ folder_id: folderId || null })
        .eq('id', documentId)

      if (updateError) throw new Error(updateError.message)

      setSuccess('Documento movido com sucesso.')
      router.refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Não foi possível mover o documento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {(error || success) && (
        <div className={`rounded-xl px-4 py-3 text-sm ${error ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error ?? success}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-neutral-900">Pastas</h2>
            <FolderPlus size={16} className="text-neutral-400" />
          </div>

          <div className="space-y-2">
            <button
              type="button"
              className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${selectedFolderId === 'all' ? 'bg-brand-50 text-brand-700' : 'hover:bg-neutral-50 text-neutral-700'}`}
              onClick={() => setSelectedFolderId('all')}
            >
              Todos os documentos
            </button>
            <button
              type="button"
              className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${selectedFolderId === 'none' ? 'bg-brand-50 text-brand-700' : 'hover:bg-neutral-50 text-neutral-700'}`}
              onClick={() => setSelectedFolderId('none')}
            >
              Sem pasta
            </button>
            {folders.map(folder => (
              <div key={folder.id} className="rounded-xl border border-neutral-200 p-3">
                <button
                  type="button"
                  className={`w-full text-left text-sm font-medium ${selectedFolderId === folder.id ? 'text-brand-700' : 'text-neutral-800'}`}
                  onClick={() => setSelectedFolderId(folder.id)}
                >
                  {folder.folder_name}
                </button>
                <p className="mt-1 text-xs text-neutral-400">
                  {projects.find(project => project.id === folder.project_id)?.project_name ?? 'Projeto vinculado'}
                </p>
                {isAdmin && (
                  <div className="mt-3">
                    {renamingFolderId === folder.id ? (
                      <div className="space-y-2">
                        <input
                          value={renameFolderName}
                          onChange={event => setRenameFolderName(event.target.value)}
                          className="input"
                          disabled={saving}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleRenameFolder(folder.id)}
                            disabled={saving || !renameFolderName.trim()}
                          >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                            Salvar
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => {
                              setRenamingFolderId(null)
                              setRenameFolderName('')
                            }}
                            disabled={saving}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-xs font-medium text-brand-600 hover:text-brand-700"
                        onClick={() => {
                          setRenamingFolderId(folder.id)
                          setRenameFolderName(folder.folder_name)
                        }}
                      >
                        <PencilLine size={14} />
                        Renomear pasta
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-sm font-semibold text-neutral-900">Nova pasta</p>
              <select
                value={newFolderProjectId}
                onChange={event => setNewFolderProjectId(event.target.value)}
                className="input"
                disabled={saving}
              >
                <option value="">Projeto</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.project_name}
                  </option>
                ))}
              </select>
              <input
                value={newFolderName}
                onChange={event => setNewFolderName(event.target.value)}
                className="input"
                placeholder="Nome da pasta"
                disabled={saving}
              />
              <button
                type="button"
                className="btn-primary w-full justify-center"
                onClick={handleCreateFolder}
                disabled={saving || !newFolderName.trim() || !newFolderProjectId}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <FolderPlus size={16} />}
                Criar pasta
              </button>
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <th className="px-5 py-3">Documento</th>
                  <th className="px-5 py-3">Projeto</th>
                  <th className="px-5 py-3">Pasta</th>
                  <th className="px-5 py-3">Categoria</th>
                  <th className="px-5 py-3">Responsável</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Visibilidade</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-sm text-neutral-500">
                      Nenhum documento encontrado para esta pasta.
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map(document => (
                    <tr key={document.id} className="transition-colors hover:bg-neutral-50">
                      <td className="px-5 py-4">
                        <div>
                          <Link href={`/dashboard/documentos/${document.id}`} className="font-medium text-neutral-900 hover:text-brand-700">
                            {document.document_name}
                          </Link>
                          <p className="mt-1 text-xs text-neutral-400">
                            Atualizado em {formatDate(document.updated_at)}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-neutral-600">{document.project_name}</td>
                      <td className="px-5 py-4 text-neutral-600">
                        {isAdmin ? (
                          <select
                            value={document.folder_id ?? ''}
                            onChange={event => handleMoveDocument(document.id, event.target.value)}
                            className="input min-w-[180px]"
                            disabled={saving}
                          >
                            <option value="">Sem pasta</option>
                            {folders
                              .filter(folder => folder.project_id === document.project_id)
                              .map(folder => (
                                <option key={folder.id} value={folder.id}>
                                  {folder.folder_name}
                                </option>
                              ))}
                          </select>
                        ) : (
                          folders.find(folder => folder.id === document.folder_id)?.folder_name ?? 'Sem pasta'
                        )}
                      </td>
                      <td className="px-5 py-4 text-neutral-600">{DOCUMENT_CATEGORY_LABELS[document.category as keyof typeof DOCUMENT_CATEGORY_LABELS]}</td>
                      <td className="px-5 py-4 text-neutral-600">{document.responsible_name ?? 'Não definido'}</td>
                      <td className="px-5 py-4">
                        <span className={`badge ${DOCUMENT_STATUS_COLORS[document.status as keyof typeof DOCUMENT_STATUS_COLORS]}`}>
                          {DOCUMENT_STATUS_LABELS[document.status as keyof typeof DOCUMENT_STATUS_LABELS]}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`badge ${DOCUMENT_VISIBILITY_COLORS[document.visibility as keyof typeof DOCUMENT_VISIBILITY_COLORS]}`}>
                          {DOCUMENT_VISIBILITY_LABELS[document.visibility as keyof typeof DOCUMENT_VISIBILITY_LABELS]}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/dashboard/documentos/${document.id}`} className="btn-ghost">
                            Ver
                          </Link>
                          <Link href={`/dashboard/documentos/${document.id}/editar`} className="btn-secondary">
                            Editar
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
