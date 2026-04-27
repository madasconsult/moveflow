import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, Plus } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import {
  CLIENT_STATUS_COLORS,
  CLIENT_STATUS_LABELS,
  formatDate,
} from '@/lib/utils'
import type { Client } from '@/types/database.types'

export const metadata: Metadata = { title: 'Clientes' }

export default async function ClientsPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role !== 'admin_faus') redirect('/unauthorized?reason=forbidden')

  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('*')
    .order('company_name')

  const clients: Client[] = (data as Client[] | null) ?? []

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">
            Gerencie a base de clientes atendidos pela FAUS com dados reais do Supabase.
          </p>
        </div>
        <Link href="/dashboard/clientes/novo" className="btn-primary">
          <Plus size={16} />
          Novo cliente
        </Link>
      </div>

      <div className="card overflow-hidden">
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Building2 size={36} className="text-neutral-300 mb-4" />
            <h2 className="text-base font-semibold text-neutral-900">Nenhum cliente cadastrado</h2>
            <p className="text-sm text-neutral-500 mt-1 max-w-md">
              Cadastre o primeiro cliente para começar a estruturar os projetos internos da Fase 2.
            </p>
            <Link href="/dashboard/clientes/novo" className="btn-primary mt-5">
              <Plus size={16} />
              Criar primeiro cliente
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <th className="px-5 py-3">Empresa</th>
                  <th className="px-5 py-3">Contato</th>
                  <th className="px-5 py-3">Unidade</th>
                  <th className="px-5 py-3">Segmento</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Atualizado em</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {clients.map(client => (
                  <tr key={client.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-5 py-4">
                      <div>
                        <Link
                          href={`/dashboard/clientes/${client.id}`}
                          className="font-medium text-neutral-900 hover:text-brand-700"
                        >
                          {client.company_name}
                        </Link>
                        <p className="text-xs text-neutral-400 mt-1">{client.contact_email ?? 'Sem e-mail cadastrado'}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {client.client_name ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {client.business_unit ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {client.segment ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`badge ${CLIENT_STATUS_COLORS[client.status]}`}>
                        {CLIENT_STATUS_LABELS[client.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-neutral-500">
                      {formatDate(client.updated_at)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/clientes/${client.id}`} className="btn-ghost">
                          Ver
                        </Link>
                        <Link href={`/dashboard/clientes/${client.id}/editar`} className="btn-secondary">
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
