import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Building2, FolderKanban, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import {
  CLIENT_STATUS_COLORS,
  CLIENT_STATUS_LABELS,
  formatDate,
} from '@/lib/utils'
import type { Client, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Detalhe do Cliente' }

interface PageProps {
  params: { id: string }
}

type ClientProjectSummary = Pick<Project, 'id' | 'project_name' | 'status' | 'phase' | 'updated_at'>

export default async function ClientDetailPage({ params }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role !== 'admin_faus') redirect('/unauthorized?reason=forbidden')

  const supabase = await createClient()

  const [{ data: clientData }, { data: projectsData }] = await Promise.all([
    supabase
      .from('clients')
      .select('*')
      .eq('id', params.id)
      .single(),
    supabase
      .from('projects')
      .select('id, project_name, status, phase, updated_at')
      .eq('client_id', params.id)
      .order('updated_at', { ascending: false }),
  ])

  const client = (clientData as Client | null) ?? null
  const projects: ClientProjectSummary[] = (projectsData as ClientProjectSummary[] | null) ?? []

  if (!client) notFound()

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">{client.company_name}</h1>
            <span className={`badge ${CLIENT_STATUS_COLORS[client.status]}`}>
              {CLIENT_STATUS_LABELS[client.status]}
            </span>
          </div>
          <p className="page-subtitle">
            Cadastro detalhado do cliente e visão simples dos projetos já vinculados.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/clientes" className="btn-secondary">
            Voltar
          </Link>
          <Link href={`/dashboard/clientes/${client.id}/editar`} className="btn-primary">
            <Pencil size={16} />
            Editar cliente
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-neutral-400" />
            <h2 className="text-sm font-semibold text-neutral-900">Informações do cliente</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-xs text-neutral-400 mb-1">Contato principal</p>
              <p className="text-sm text-neutral-800">{client.client_name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 mb-1">Unidade de negócio</p>
              <p className="text-sm text-neutral-800">{client.business_unit ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 mb-1">Segmento</p>
              <p className="text-sm text-neutral-800">{client.segment ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 mb-1">Atualizado em</p>
              <p className="text-sm text-neutral-800">{formatDate(client.updated_at)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 mb-1">E-mail</p>
              <p className="text-sm text-neutral-800">{client.contact_email ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 mb-1">Telefone</p>
              <p className="text-sm text-neutral-800">{client.contact_phone ?? '—'}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs text-neutral-400 mb-1">Observações</p>
              <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                {client.notes ?? 'Nenhuma observação cadastrada.'}
              </p>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <FolderKanban size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Projetos vinculados</h2>
            </div>
            <span className="text-xs text-neutral-400">{projects.length} projeto(s)</span>
          </div>

          {projects.length === 0 ? (
            <div className="px-5 py-10 text-sm text-neutral-500">
              Ainda não há projetos vinculados a este cliente.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {projects.map(project => (
                <Link
                  key={project.id}
                  href={`/dashboard/projetos/${project.id}`}
                  className="block px-5 py-4 hover:bg-neutral-50 transition-colors"
                >
                  <p className="text-sm font-medium text-neutral-900">{project.project_name}</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Atualizado em {formatDate(project.updated_at)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
