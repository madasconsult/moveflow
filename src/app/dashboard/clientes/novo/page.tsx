import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { ClientForm } from '@/components/clients/ClientForm'

export const metadata: Metadata = { title: 'Novo Cliente' }

export default async function NewClientPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="page-title">Novo cliente</h1>
        <p className="page-subtitle">
          Cadastre o cliente com os dados essenciais para iniciar o relacionamento e seus projetos.
        </p>
      </div>

      <ClientForm mode="create" />
    </div>
  )
}
