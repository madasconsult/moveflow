'use client'

import Link from 'next/link'
import {
  FolderKanban, CheckSquare, AlertTriangle,
  Clock, ArrowRight, TrendingUp,
} from 'lucide-react'
import { cn, ROLE_LABELS, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/lib/utils'
import type { Profile, ProjectStatus } from '@/types/database.types'

interface Stats {
  totalProjects: number
  activeProjects: number
  pendingActions: number
  overdueActions: number
  waitingClient: number
}

interface RecentProject {
  id: string
  project_name: string
  status: string
  phase: string
  progress_percentage: number
}

interface DashboardHomeProps {
  profile: Profile
  stats: Stats
  recentProjects: RecentProject[]
}

export function DashboardHome({ profile, stats, recentProjects }: DashboardHomeProps) {
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Bom dia' :
    hour < 18 ? 'Boa tarde' : 'Boa noite'

  const firstName = profile.full_name.split(' ')[0]

  const statCards = [
    {
      label: 'Projetos ativos',
      value: stats.activeProjects,
      total: stats.totalProjects,
      icon: FolderKanban,
      href: '/dashboard/projetos',
      color: 'text-[#1f64c8]',
      bg: 'bg-[#edf4ff]',
      note: 'Resumo operacional atualizado',
    },
    {
      label: 'Ações pendentes',
      value: stats.pendingActions,
      icon: CheckSquare,
      href: '/dashboard/acoes',
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      note: 'Acesso rápido ao módulo',
    },
    {
      label: 'Ações atrasadas',
      value: stats.overdueActions,
      icon: AlertTriangle,
      href: '/dashboard/acoes',
      color: stats.overdueActions > 0 ? 'text-red-600' : 'text-slate-400',
      bg: stats.overdueActions > 0 ? 'bg-red-50' : 'bg-slate-100',
      note: 'Pontos que exigem atenção',
    },
    {
      label: 'Aguardando cliente',
      value: stats.waitingClient,
      icon: Clock,
      href: '/dashboard/acoes',
      color: stats.waitingClient > 0 ? 'text-amber-600' : 'text-slate-400',
      bg: stats.waitingClient > 0 ? 'bg-amber-50' : 'bg-slate-100',
      note: 'Dependências externas',
    },
  ]

  const moduleLinks = [
    { label: 'Ações', href: '/dashboard/acoes', icon: CheckSquare },
    { label: 'KPIs', href: '/dashboard/kpis', icon: TrendingUp },
    { label: 'Reuniões', href: '/dashboard/reunioes', icon: Clock },
    { label: 'Documentos', href: '/dashboard/documentos', icon: FolderKanban },
    { label: 'Timeline', href: '/dashboard/timeline', icon: AlertTriangle },
    ...(profile.role === 'admin_faus'
      ? [{ label: 'Clientes', href: '/dashboard/clientes', icon: FolderKanban }]
      : []),
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f4f8fd_52%,#edf4ff_100%)] p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)] lg:p-8">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#1f64c8]">
              Dashboard Executivo
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 lg:text-4xl">
              {greeting}, {firstName}.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
              Acompanhe a operação com uma leitura rápida dos projetos, ações e pontos de atenção
              do ambiente interno do MOVE FLOW.
            </p>
            <p className="mt-4 text-sm font-medium text-slate-500">
              {ROLE_LABELS[profile.role]} · {profile.email}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[420px]">
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Total</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.totalProjects}</p>
              <p className="mt-1 text-xs text-slate-500">Projetos monitorados</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Ativos</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.activeProjects}</p>
              <p className="mt-1 text-xs text-slate-500">Em andamento</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Pendências</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.pendingActions}</p>
              <p className="mt-1 text-xs text-slate-500">Ações abertas</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map(card => {
          const Icon = card.icon
          return (
            <Link
              key={card.label}
              href={card.href}
              className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(15,23,42,0.1)]"
            >
              <div className="flex items-start justify-between">
                <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', card.bg)}>
                  <Icon size={18} className={card.color} />
                </div>
                <ArrowRight
                  size={15}
                  className="text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-500"
                />
              </div>
              <div className="mt-6">
                <p className="text-3xl font-semibold text-slate-900">
                  {card.value}
                  {card.total !== undefined && (
                    <span className="ml-1 text-sm font-normal text-slate-400">
                      / {card.total}
                    </span>
                  )}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-700">{card.label}</p>
                <p className="mt-1 text-xs text-slate-400">{card.note}</p>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(290px,0.85fr)]">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_56px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#edf4ff]">
                <FolderKanban size={18} className="text-[#1f64c8]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Projetos recentes</h2>
                <p className="text-xs text-slate-500">Leitura rápida dos projetos mais recentes da operação.</p>
              </div>
            </div>
            <Link
              href="/dashboard/projetos"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1f64c8] hover:text-[#184e96]"
            >
              Ver todos
              <ArrowRight size={12} />
            </Link>
          </div>

          {recentProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <FolderKanban size={34} className="mb-4 text-slate-300" />
              <p className="text-sm text-slate-500">Nenhum projeto encontrado.</p>
              {profile.role === 'admin_faus' && (
                <Link href="/dashboard/projetos" className="btn-primary mt-5 text-sm">
                  Criar primeiro projeto
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentProjects.map(project => (
                <Link
                  key={project.id}
                  href={`/dashboard/projetos/${project.id}`}
                  className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-slate-50/85"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#edf4ff]">
                    <FolderKanban size={16} className="text-[#1f64c8]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-[#184e96]">
                      {project.project_name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {PROJECT_STATUS_LABELS[project.phase as ProjectStatus] ?? project.phase}
                    </p>
                  </div>

                  <div className="hidden items-center gap-2 sm:flex">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#1f64c8_0%,#5fb1ff_100%)]"
                        style={{ width: `${project.progress_percentage}%` }}
                      />
                    </div>
                    <span className="w-9 text-right text-xs text-slate-500">
                      {project.progress_percentage}%
                    </span>
                  </div>

                  <span className={cn(
                    'badge',
                    PROJECT_STATUS_COLORS[project.status as ProjectStatus] ?? 'bg-neutral-100 text-neutral-500'
                  )}>
                    {PROJECT_STATUS_LABELS[project.status as ProjectStatus] ?? project.status}
                  </span>

                  <ArrowRight size={14} className="shrink-0 text-slate-300 group-hover:text-slate-500" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#edf4ff]">
                <TrendingUp size={18} className="text-[#1f64c8]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Visão rápida</h2>
                <p className="text-xs text-slate-500">Indicadores imediatos do painel.</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-600">Projetos ativos</span>
                  <span className="font-semibold text-slate-900">{stats.activeProjects}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#1f64c8_0%,#5fb1ff_100%)]"
                    style={{ width: `${stats.totalProjects > 0 ? (stats.activeProjects / stats.totalProjects) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-600">Aguardando cliente</span>
                  <span className="font-semibold text-slate-900">{stats.waitingClient}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Itens que dependem de validação, retorno ou avanço do cliente.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-600">Ações atrasadas</span>
                  <span className="font-semibold text-slate-900">{stats.overdueActions}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Acompanhe itens que exigem atenção mais imediata da operação.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
              Módulos
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {moduleLinks.map(item => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition-all hover:border-[#bfd7ff] hover:bg-[#f6faff]"
                  >
                    <Icon size={18} className="text-slate-500 transition-colors group-hover:text-[#1f64c8]" />
                    <span className="mt-3 block text-sm font-medium text-slate-700 transition-colors group-hover:text-[#184e96]">
                      {item.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
