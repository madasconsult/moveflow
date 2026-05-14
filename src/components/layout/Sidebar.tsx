'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Building2, FolderKanban, CheckSquare,
  CalendarDays, FileText, TrendingUp, History, Users, SearchCheck,
} from 'lucide-react'
import { canManageUsers, cn, ROLE_LABELS } from '@/lib/utils'
import { DASHBOARD_NAV_ITEMS, ADMIN_NAV_ITEMS, getNavItemsForRole } from '@/lib/utils/navigation'
import type { Profile } from '@/types/database.types'
import { getInitials } from '@/lib/utils'

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Building2,
  FolderKanban,
  CheckSquare,
  CalendarDays,
  FileText,
  TrendingUp,
  SearchCheck,
  History,
  Users,
}

interface SidebarProps {
  profile: Profile
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()

  const items = getNavItemsForRole(DASHBOARD_NAV_ITEMS, profile.role)
  const principalItems = items.filter(item => item.href !== '/dashboard/clientes')
  const cadastroItems = items.filter(item => item.href === '/dashboard/clientes')
  const adminItems = canManageUsers(profile.role)
    ? getNavItemsForRole(ADMIN_NAV_ITEMS, profile.role)
    : []

  function renderItems(sectionItems: typeof items) {
    return sectionItems.map(item => {
      const Icon = ICON_MAP[item.icon]
      const isActive = item.href === '/dashboard'
        ? pathname === '/dashboard'
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
    })
  }

  return (
    <aside className="dashboard-sidebar flex flex-col w-sidebar shrink-0 h-full border-r border-white/10 shadow-[8px_0_32px_rgba(7,20,39,0.22)]">
      <div className="flex items-center px-6 py-6 shrink-0">
        <Image
          src="/branding/move-logo-color.png"
          alt="MOVE FLOW"
          width={196}
          height={84}
          priority
          className="h-14 w-[172px] object-contain"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
        <div>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400/80">
            Principal
          </p>
          <div className="space-y-1">
            {renderItems(principalItems)}
          </div>
        </div>

        {cadastroItems.length > 0 && (
          <div>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400/80">
              Cadastros
            </p>
            <div className="space-y-1">
              {renderItems(cadastroItems)}
            </div>
          </div>
        )}

        {adminItems.length > 0 && (
          <div>
            <div className="px-3 pb-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400/80">
                Administração
              </p>
            </div>
            <div className="space-y-1">
              {renderItems(adminItems)}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-white/10 px-4 py-4 shrink-0">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/12 text-xs font-semibold text-white">
            {getInitials(profile.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {profile.full_name}
            </p>
            <p className="text-[11px] text-slate-300/80 truncate">
              {ROLE_LABELS[profile.role]}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
