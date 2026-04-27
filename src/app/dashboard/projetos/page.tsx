import type { Metadata } from 'next'
import Link from 'next/link'
import { FolderKanban, Plus } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import {
  PROJECT_PHASE_LABELS,
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  STRATEGIC_FOCUS_LABELS,
  cn,
  formatDate,
} from '@/lib/utils'
import type { Client, Profile, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Projetos' }

type ProjectListItem = Pick<
  Project,
  | 'id'
  | 'client_id'
  | 'project_name'
  | 'status'
  | 'phase'
  | 'progress_percentage'
  | 'main_consultant_id'
  | 'strategic_focus'
  | 'updated_at'
>

type ClientLookup = Pick<Client, 'id' | 'company_name'>
type ConsultantLookup = Pick<Profile, 'id' | 'full_name'>

export default async function ProjectsPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const supabase = await createClient()

  const { data: projectsData } = await supabase
    .from('projects')
    .select('id, client_id, project_name, status, phase, progress_percentage, main_consultant_id, strategic_focus, updated_at')
    .order('updated_at', { ascending: false })

  const projects: ProjectListItem[] = (projectsData as ProjectListItem[] | null) ?? []

  const clientIds = Array.from(new Set(projects.map(project => project.client_id)))
  const consultantIds = Array.from(
    new Set(projects.map(project => project.main_consultant_id).filter(Boolean) as string[])
  )

  const [clientsRes, consultantsRes] = await Promise.all([
    clientIds.length > 0
      ? supabase.from('clients').select('id, company_name').in('id', clientIds)
      : Promise.resolve({ data: [] as ClientLookup[] | null }),
    consultantIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', consultantIds)
      : Promise.resolve({ data: [] as ConsultantLookup[] | null }),
  ])

  const clients = (clientsRes.data as ClientLookup[] | null) ?? []
  const consultants = (consultantsRes.data as ConsultantLookup[] | null) ?? []

  const clientMap = new Map(clients.map(client => [client.id, client.company_name]))
  const consultantMap = new Map(consultants.map(consultant => [consultant.id, consultant.full_name]))

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projetos</h1>
          <p className="page-subtitle">
            {session.profile.role === 'admin_faus'
              ? 'Acompanhe, crie e edite os projetos internos da operação FAUS.'
              : 'Acompanhe e atualize apenas os projetos aos quais você está vinculado.'}
          </p>
        </div>
        {session.profile.role === 'admin_faus' && (
          <Link href="/dashboard/projetos/novo" className="btn-primary">
            <Plus size={16} />
            Novo projeto
          </Link>
        )}
      </div>

      <div className="card overflow-hidden">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <FolderKanban size={36} className="text-neutral-300 mb-4" />
            <h2 className="text-base font-semibold text-neutral-900">Nenhum projeto disponível</h2>
            <p className="text-sm text-neutral-500 mt-1 max-w-md">
              {session.profile.role === 'admin_faus'
                ? 'Crie o primeiro projeto para ativar os módulos internos da Fase 2.'
                : 'Os projetos vinculados ao seu perfil aparecerão aqui automaticamente conforme o vínculo no banco.'}
            </p>
            {session.profile.role === 'admin_faus' && (
              <Link href="/dashboard/projetos/novo" className="btn-primary mt-5">
                <Plus size={16} />
                Criar primeiro projeto
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <th className="px-5 py-3">Projeto</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Consultor</th>
                  <th className="px-5 py-3">Foco estratégico</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Fase</th>
                  <th className="px-5 py-3">Progresso</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {projects.map(project => (
                  <tr key={project.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-5 py-4">
                      <div>
                        <Link
                          href={`/dashboard/projetos/${project.id}`}
                          className="font-medium text-neutral-900 hover:text-brand-700"
                        >
                          {project.project_name}
                        </Link>
                        <p className="text-xs text-neutral-400 mt-1">Atualizado em {formatDate(project.updated_at)}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {clientMap.get(project.client_id) ?? 'Cliente vinculado'}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {project.main_consultant_id
                        ? consultantMap.get(project.main_consultant_id) ?? 'Consultor vinculado'
                        : 'Não definido'}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {STRATEGIC_FOCUS_LABELS[project.strategic_focus]}
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn('badge', PROJECT_STATUS_COLORS[project.status])}>
                        {PROJECT_STATUS_LABELS[project.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {PROJECT_PHASE_LABELS[project.phase]}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 min-w-28">
                        <div className="h-2 flex-1 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full"
                            style={{ width: `${project.progress_percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-neutral-500 w-8 text-right">
                          {project.progress_percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/projetos/${project.id}`} className="btn-ghost">
                          Ver
                        </Link>
                        <Link href={`/dashboard/projetos/${project.id}/editar`} className="btn-secondary">
                          Editar
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
