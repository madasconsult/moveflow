import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { ClientForm } from '@/components/clients/ClientForm'
import type { Client } from '@/types/database.types'

export const metadata: Metadata = { title: 'Editar Cliente' }

interface PageProps {
  params: { id: string }
}

export default async function EditClientPage({ params }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role !== 'admin_faus') redirect('/unauthorized?reason=forbidden')

  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('id', params.id)
    .single()

  const client = (data as Client | null) ?? null

  if (!client) notFound()

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="page-title">Editar cliente</h1>
        <p className="page-subtitle">
          Atualize os dados principais do cliente sem sair do fluxo interno da FAUS.
        </p>
      </div>

      <ClientForm mode="edit" initialData={client} />
    </div>
  )
}
