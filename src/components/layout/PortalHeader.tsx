'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database.types'
import { getInitials, ROLE_LABELS } from '@/lib/utils'

interface PortalHeaderProps {
  profile: Profile
}

export function PortalHeader({ profile }: PortalHeaderProps) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex items-center justify-between h-[60px] px-6 bg-white border-b border-neutral-200 shrink-0">
      <div />

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-2">
          <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold">
            {getInitials(profile.full_name)}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-neutral-900 leading-none">
              {profile.full_name.split(' ')[0]}
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {ROLE_LABELS[profile.role]}
            </p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="btn-ghost p-2 text-neutral-500 hover:text-red-600 hover:bg-red-50"
          aria-label="Sair"
          title="Sair"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
