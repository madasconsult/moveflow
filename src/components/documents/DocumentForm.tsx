'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_VISIBILITY_LABELS,
} from '@/lib/utils'
import type {
  Document,
  DocumentCategory,
  DocumentStatus,
  DocumentVisibility,
  InsertDto,
  Profile,
  Project,
  UpdateDto,
} from '@/types/database.types'

interface ProjectOption {
  id: string
  project_name: string
}

interface ResponsibleOption {
  id: string
  full_name: string
}

interface FolderOption {
  id: string
  project_id: string
  folder_name: string
}

interface DocumentFormProps {
  mode: 'create' | 'edit'
  initialData?: Document
  projects: ProjectOption[]
  responsibles: ResponsibleOption[]
  folders: FolderOption[]
  canChooseProject: boolean
}

interface FormErrors {
  project_id?: string
  document_name?: string
}

export function DocumentForm({
  mode,
  initialData,
  projects,
  responsibles,
  folders,
  canChooseProject,
}: DocumentFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [projectId, setProjectId] = useState(initialData?.project_id ?? projects[0]?.id ?? '')
  const [documentName, setDocumentName] = useState(initialData?.document_name ?? '')
  const [folderId, setFolderId] = useState(initialData?.folder_id ?? '')
  const [category, setCategory] = useState<DocumentCategory>(initialData?.category ?? 'support_doc')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [documentDate, setDocumentDate] = useState(initialData?.document_date ?? '')
  const [responsibleId, setResponsibleId] = useState(initialData?.responsible_id ?? '')
  const [fileUrl, setFileUrl] = useState(initialData?.file_url ?? '')
  const [externalLink, setExternalLink] = useState(initialData?.external_link ?? '')
  const [status, setStatus] = useState<DocumentStatus>(initialData?.status ?? 'draft')
  const [visibility, setVisibility] = useState<DocumentVisibility>(initialData?.visibility ?? 'internal')
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const categoryOptions = useMemo(
    () => Object.entries(DOCUMENT_CATEGORY_LABELS) as [DocumentCategory, string][],
    []
  )
  const statusOptions = useMemo(
    () => Object.entries(DOCUMENT_STATUS_LABELS) as [DocumentStatus, string][],
    []
  )
  const visibilityOptions = useMemo(
    () => Object.entries(DOCUMENT_VISIBILITY_LABELS) as [DocumentVisibility, string][],
    []
  )

  function validate() {
    const nextErrors: FormErrors = {}

    if (!projectId) nextErrors.project_id = 'Selecione o projeto vinculado.'
    if (!documentName.trim()) nextErrors.document_name = 'Informe o nome do documento.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!validate()) return

    setSaving(true)

    const documentNameValue = documentName.trim()
    const descriptionValue = description.trim() || null
    const documentDateValue = documentDate || null
    const responsibleIdValue = responsibleId || null
    const fileUrlValue = fileUrl.trim() || null
    const externalLinkValue = externalLink.trim() || null

    const updatePayload: UpdateDto<'documents'> = {
      folder_id: folderId || null,
      document_name: documentNameValue,
      category,
      description: descriptionValue,
      status,
      visibility,
    }

    try {
      const documentsTable = supabase.from('documents') as any

      if (mode === 'create') {
        const { data: authData } = await supabase.auth.getUser()
        const insertPayload: InsertDto<'documents'> = {
          project_id: projectId,
          folder_id: folderId || null,
          document_name: documentNameValue,
          category,
          description: descriptionValue,
          document_date: documentDateValue,
          responsible_id: responsibleIdValue,
          file_url: fileUrlValue,
          external_link: externalLinkValue,
          status,
          visibility,
          created_by: authData.user?.id ?? null,
        }

        const { data, error } = await documentsTable
          .insert(insertPayload)
          .select('id')
          .single()

        if (error || !data) {
          throw new Error(error?.message ?? 'Não foi possível criar o documento.')
        }

        router.push(`/dashboard/documentos/${(data as { id: string }).id}`)
      } else if (initialData) {
        const { data, error } = await documentsTable
          .update(updatePayload)
          .eq('id', initialData.id)
          .select('id')
          .single()

        if (error || !data) {
          throw new Error(error?.message ?? 'Não foi possível atualizar o documento.')
        }

        router.push(`/dashboard/documentos/${(data as { id: string }).id}`)
      }

      router.refresh()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o documento. Tente novamente.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="project_id" className="label">
            Projeto *
          </label>
          <select
            id="project_id"
            value={projectId}
            onChange={event => setProjectId(event.target.value)}
            className="input"
            disabled={saving || mode === 'edit' || !canChooseProject}
          >
            <option value="">Selecione</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.project_name}
              </option>
            ))}
          </select>
          {errors.project_id && <p className="mt-1 text-xs text-red-600">{errors.project_id}</p>}
        </div>

        <div>
          <label htmlFor="responsible_id" className="label">
            Responsável
          </label>
          <select
            id="responsible_id"
            value={responsibleId}
            onChange={event => setResponsibleId(event.target.value)}
            className="input"
            disabled={saving || mode === 'edit'}
          >
            <option value="">Não definido</option>
            {responsibles.map(option => (
              <option key={option.id} value={option.id}>
                {option.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="folder_id" className="label">
            Pasta
          </label>
          <select
            id="folder_id"
            value={folderId}
            onChange={event => setFolderId(event.target.value)}
            className="input"
            disabled={saving}
          >
            <option value="">Sem pasta</option>
            {folders
              .filter(folder => folder.project_id === projectId)
              .map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.folder_name}
                </option>
              ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="document_name" className="label">
            Nome do documento *
          </label>
          <input
            id="document_name"
            value={documentName}
            onChange={event => setDocumentName(event.target.value)}
            className="input"
            placeholder="Ex.: Relatório executivo da semana 12"
            disabled={saving}
          />
          {errors.document_name && <p className="mt-1 text-xs text-red-600">{errors.document_name}</p>}
        </div>

        <div>
          <label htmlFor="category" className="label">
            Categoria
          </label>
          <select
            id="category"
            value={category}
            onChange={event => setCategory(event.target.value as DocumentCategory)}
            className="input"
            disabled={saving}
          >
            {categoryOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status" className="label">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={event => setStatus(event.target.value as DocumentStatus)}
            className="input"
            disabled={saving}
          >
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="visibility" className="label">
            Visibilidade
          </label>
          <select
            id="visibility"
            value={visibility}
            onChange={event => setVisibility(event.target.value as DocumentVisibility)}
            className="input"
            disabled={saving}
          >
            {visibilityOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="document_date" className="label">
            Data do documento
          </label>
          <input
            id="document_date"
            type="date"
            value={documentDate}
            onChange={event => setDocumentDate(event.target.value)}
            className="input"
            disabled={saving || mode === 'edit'}
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="description" className="label">
            Descrição
          </label>
          <textarea
            id="description"
            value={description}
            onChange={event => setDescription(event.target.value)}
            className="input min-h-24 resize-y"
            placeholder="Contexto e finalidade do documento."
            disabled={saving}
          />
        </div>

        <div>
          <label htmlFor="external_link" className="label">
            Link externo
          </label>
          <input
            id="external_link"
            value={externalLink}
            onChange={event => setExternalLink(event.target.value)}
            className="input"
            placeholder="https://..."
            disabled={saving || mode === 'edit'}
          />
        </div>

        <div>
          <label htmlFor="file_url" className="label">
            URL do arquivo
          </label>
          <input
            id="file_url"
            value={fileUrl}
            onChange={event => setFileUrl(event.target.value)}
            className="input"
            placeholder="https://..."
            disabled={saving || mode === 'edit'}
          />
        </div>
      </div>

      {mode === 'edit' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Na edição, este schema atual permite atualizar nome, categoria, descrição, status e visibilidade. Projeto, links e responsável permanecem somente para leitura.
        </div>
      )}

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href={initialData ? `/dashboard/documentos/${initialData.id}` : '/dashboard/documentos'} className="btn-secondary">
          Cancelar
        </Link>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving && <Loader2 size={16} className="animate-spin" />}
          {mode === 'create' ? 'Criar documento' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}
