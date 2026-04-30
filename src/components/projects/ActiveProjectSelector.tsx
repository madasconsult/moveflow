'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FolderKanban, Loader2 } from 'lucide-react'
import { ACTIVE_PROJECT_COOKIE } from '@/lib/active-project/constants'
import type { ActiveProjectOption } from '@/lib/active-project/server'

interface ActiveProjectSelectorProps {
  projects: ActiveProjectOption[]
  activeProjectId: string | null
}

const STORAGE_KEY = ACTIVE_PROJECT_COOKIE

function persistProject(projectId: string | null) {
  if (projectId) {
    document.cookie = `${ACTIVE_PROJECT_COOKIE}=${projectId}; path=/; max-age=31536000; samesite=lax`
    window.localStorage.setItem(STORAGE_KEY, projectId)
    return
  }

  document.cookie = `${ACTIVE_PROJECT_COOKIE}=; path=/; max-age=0; samesite=lax`
  window.localStorage.removeItem(STORAGE_KEY)
}

export function ActiveProjectSelector({
  projects,
  activeProjectId,
}: ActiveProjectSelectorProps) {
  const router = useRouter()
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId ?? '')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const availableIds = new Set(projects.map(project => project.id))
    const storedProjectId = window.localStorage.getItem(STORAGE_KEY)

    if (activeProjectId && availableIds.has(activeProjectId)) {
      setSelectedProjectId(activeProjectId)
      window.localStorage.setItem(STORAGE_KEY, activeProjectId)
      return
    }

    if (storedProjectId && availableIds.has(storedProjectId)) {
      setSelectedProjectId(storedProjectId)
      persistProject(storedProjectId)
      startTransition(() => router.refresh())
      return
    }

    if (storedProjectId) {
      window.localStorage.removeItem(STORAGE_KEY)
    }

    if (projects.length === 1) {
      setSelectedProjectId(projects[0].id)
      persistProject(projects[0].id)
      startTransition(() => router.refresh())
      return
    }

    setSelectedProjectId('')
  }, [activeProjectId, projects, router])

  function handleChange(projectId: string) {
    setSelectedProjectId(projectId)
    persistProject(projectId || null)
    startTransition(() => router.refresh())
  }

  const activeProject = projects.find(project => project.id === selectedProjectId) ?? null

  return (
    <div className="min-w-[260px] rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        <FolderKanban size={13} />
        Projeto Ativo
        {isPending && <Loader2 size={12} className="animate-spin" />}
      </div>
      <select
        value={selectedProjectId}
        onChange={event => handleChange(event.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
        disabled={projects.length === 0 || isPending}
        aria-label="Selecionar projeto ativo"
      >
        <option value="">
          {projects.length === 0 ? 'Nenhum projeto disponível' : 'Selecione um projeto'}
        </option>
        {projects.map(project => (
          <option key={project.id} value={project.id}>
            {project.project_name}
            {project.client_name ? ` · ${project.client_name}` : ''}
          </option>
        ))}
      </select>
      <p className="mt-1 truncate text-[11px] text-slate-500">
        {activeProject?.client_name ?? 'Contexto dos módulos operacionais'}
      </p>
    </div>
  )
}
