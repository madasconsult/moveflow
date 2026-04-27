'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CheckSquare, CalendarDays, FileText, TrendingUp,
} from 'lucide-react'
import { cn, ROLE_LABELS, getInitials } from '@/lib/utils'
import { PORTAL_NAV_ITEMS } from '@/lib/utils/navigation'
import type { Profile } from '@/types/database.types'

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, CheckSquare, CalendarDays, FileText, TrendingUp,
}

interface PortalSidebarProps {
  profile: Profile
}

export function PortalSidebar({ profile }: PortalSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="dashboard-sidebar flex flex-col w-sidebar shrink-0 h-full border-r border-white/10 shadow-[8px_0_32px_rgba(7,20,39,0.22)]">
      <div className="flex items-center px-6 py-6 shrink-0">
        <div>
          <Image
            src="/branding/move-logo-color.png"
            alt="MOVE FLOW"
            width={196}
            height={84}
            priority
            className="h-14 w-[172px] object-contain"
          />
          <span className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400/80">
            Portal do Cliente
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-3">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400/80">
          Principal
        </p>
        <div className="space-y-1">
          {PORTAL_NAV_ITEMS.map(item => {
            const Icon = ICON_MAP[item.icon]
            const isActive = item.href === '/portal'
              ? pathname === '/portal'
              : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(isActive ? 'nav-item-active' : 'nav-item')}
              >
                {Icon && <Icon size={17} className="shrink-0" />}
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 px-4 py-4 shrink-0">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/12 text-xs font-semibold text-white">
            {getInitials(profile.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{profile.full_name}</p>
            <p className="text-[11px] text-slate-300/80 truncate">{ROLE_LABELS[profile.role]}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
