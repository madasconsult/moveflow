import type { Metadata } from 'next'
import { ShieldCheck, Users } from 'lucide-react'
import { redirect } from 'next/navigation'
import { UsersManagementTable } from '@/components/users/UsersManagementTable'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'
import { ROLE_LABELS } from '@/lib/utils'
import type { Profile } from '@/types/database.types'

export const metadata: Metadata = { title: 'Usuários' }

type UserRow = Pick<
  Profile,
  'id' | 'full_name' | 'email' | 'role' | 'is_active' | 'created_at'
>

export default async function UsersPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role !== 'admin_faus') redirect('/unauthorized?reason=forbidden')

  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, created_at')
    .order('created_at', { ascending: false })

  const users = (data as UserRow[] | null) ?? []
  const activeUsers = users.filter(user => user.is_active).length

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Usuários e perfis</h1>
          <p className="page-subtitle">
            Gestão administrativa dos perfis já existentes no sistema, sem criação de usuários no Auth.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-neutral-400" />
            <p className="text-sm font-semibold text-neutral-900">Usuários cadastrados</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-neutral-900">{users.length}</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-neutral-400" />
            <p className="text-sm font-semibold text-neutral-900">Ativos</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-neutral-900">{activeUsers}</p>
        </div>

        <div className="card p-5">
          <p className="text-sm font-semibold text-neutral-900">Perfis permitidos</p>
          <div className="mt-3 space-y-2 text-sm text-neutral-700">
            <p>{ROLE_LABELS.admin_faus}</p>
            <p>{ROLE_LABELS.consultor_faus}</p>
            <p>{ROLE_LABELS.cliente}</p>
          </div>
        </div>
      </div>

      <UsersManagementTable users={users} />
    </div>
  )
}
