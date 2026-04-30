'use client'

import { useRouter } from 'next/navigation'
import { LogOut, Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ActiveProjectSelector } from '@/components/projects/ActiveProjectSelector'
import type { Profile } from '@/types/database.types'
import type { ActiveProjectOption } from '@/lib/active-project/server'
import { getInitials, ROLE_LABELS } from '@/lib/utils'

interface HeaderProps {
  profile: Profile
  projects: ActiveProjectOption[]
  activeProjectId: string | null
}

export function Header({ profile, projects, activeProjectId }: HeaderProps) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="dashboard-header flex items-center justify-between px-6 py-4 shrink-0">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">
          Painel Interno
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Visão executiva do ambiente MOVE FLOW.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <ActiveProjectSelector projects={projects} activeProjectId={activeProjectId} />

        <button
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm"
          aria-label="Notificações"
          title="Em breve"
          disabled
        >
          <Bell size={17} className="text-neutral-400" />
        </button>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#184e96_0%,#0d2748_100%)] text-xs font-semibold text-white">
            {getInitials(profile.full_name)}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-neutral-900 leading-none">
              {profile.full_name.split(' ')[0]}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {ROLE_LABELS[profile.role]}
            </p>
          </div>

          <button
            onClick={handleSignOut}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
