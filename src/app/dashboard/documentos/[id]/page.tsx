import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { FileText, Link as LinkIcon, Pencil, UserCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_STATUS_COLORS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_VISIBILITY_COLORS,
  DOCUMENT_VISIBILITY_LABELS,
  cn,
  formatDate,
} from '@/lib/utils'
import type { Document, DocumentFolder, Profile, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Detalhe do Documento' }

interface PageProps {
  params: { id: string }
}

type ProjectLookup = Pick<Project, 'id' | 'project_name'>
type ResponsibleLookup = Pick<Profile, 'id' | 'full_name' | 'email'>
type FolderLookup = Pick<DocumentFolder, 'id' | 'folder_name'>

export default async function DocumentDetailPage({ params }: PageProps) {
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

  const [projectRes, responsibleRes, folderRes] = await Promise.all([
    supabase.from('projects').select('id, project_name').eq('id', document.project_id).single(),
    document.responsible_id
      ? supabase.from('profiles').select('id, full_name, email').eq('id', document.responsible_id).single()
      : Promise.resolve({ data: null }),
    document.folder_id
      ? supabase.from('document_folders').select('id, folder_name').eq('id', document.folder_id).single()
      : Promise.resolve({ data: null }),
  ])

  const project = (projectRes.data as ProjectLookup | null) ?? null
  const responsible = (responsibleRes.data as ResponsibleLookup | null) ?? null
  const folder = (folderRes.data as FolderLookup | null) ?? null

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">{document.document_name}</h1>
            <span className={cn('badge', DOCUMENT_STATUS_COLORS[document.status])}>
              {DOCUMENT_STATUS_LABELS[document.status]}
            </span>
          </div>
          <p className="page-subtitle">
            Visão simples do documento, projeto vinculado e regras de visibilidade.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/documentos" className="btn-secondary">
            Voltar
          </Link>
          <Link href={`/dashboard/documentos/${document.id}/editar`} className="btn-primary">
            <Pencil size={16} />
            Editar documento
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Contexto do documento</h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-neutral-400">Projeto</p>
                <p className="text-sm text-neutral-800">{project?.project_name ?? 'Projeto vinculado'}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Categoria</p>
                <p className="text-sm text-neutral-800">{DOCUMENT_CATEGORY_LABELS[document.category]}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Pasta</p>
                <p className="text-sm text-neutral-800">{folder?.folder_name ?? 'Sem pasta'}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Data do documento</p>
                <p className="text-sm text-neutral-800">{formatDate(document.document_date)}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Atualizado em</p>
                <p className="text-sm text-neutral-800">{formatDate(document.updated_at)}</p>
              </div>
              <div className="md:col-span-2">
                <p className="mb-1 text-xs text-neutral-400">Descrição</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                  {document.description ?? 'Nenhuma descrição registrada.'}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <LinkIcon size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Acesso ao documento</h2>
            </div>

            <div className="space-y-3 text-sm text-neutral-700">
              {document.external_link ? (
                <a href={document.external_link} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-700">
                  Abrir link externo
                </a>
              ) : null}
              {document.file_url ? (
                <a href={document.file_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-700">
                  Abrir URL do arquivo
                </a>
              ) : null}
              {!document.external_link && !document.file_url && (
                <p>Nenhum link disponível neste registro.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <UserCircle2 size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Responsável</h2>
            </div>

            {responsible ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-900">{responsible.full_name}</p>
                <p className="text-sm text-neutral-500">{responsible.email}</p>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Nenhum responsável definido.</p>
            )}
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900">Visibilidade</h2>
            <span className={cn('badge', DOCUMENT_VISIBILITY_COLORS[document.visibility])}>
              {DOCUMENT_VISIBILITY_LABELS[document.visibility]}
            </span>
            <p className="text-sm text-neutral-600">
              {document.visibility === 'client_and_faus'
                ? 'Este documento pode ser compartilhado com o cliente.'
                : 'Este documento é restrito ao ambiente interno da FAUS.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
