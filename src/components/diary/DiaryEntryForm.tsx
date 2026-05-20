'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRightFromLine, Loader2, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  buildDiaryTitle,
  DELIVERABLE_STATUS_CLASSES,
  DELIVERABLE_STATUS_LABELS,
  type DeliverableStatus,
} from '@/lib/diary-board'
import type { DiaryDeliverable, DiaryEntry } from '@/types/database.types'

interface ProjectOption {
  id: string
  project_name: string
  client_name: string | null
}

interface DiaryEntryFormProps {
  mode: 'create' | 'edit'
  projects: ProjectOption[]
  activeProjectId?: string | null
  canChooseProject: boolean
  initialData?: DiaryEntry
  initialDeliverables?: DiaryDeliverable[]
}

interface FormErrors {
  project_id?: string
  title?: string
  start_date?: string
  end_date?: string
  faus_people?: string
  deliverables?: string
}

interface DeliverableFormItem {
  tempId: string
  id?: string
  description: string
  status: DeliverableStatus
  completion_date: string
  notes: string
  is_carried_over: boolean
  origin_deliverable_id: string | null
  carried_from_diary_entry_id: string | null
  carried_from_entry_title: string
}

interface PendingDeliverableOption {
  id: string
  description: string
  status: 'pending' | 'partial'
  notes: string | null
  diary_entry_id: string
  entry_title: string
  // Non-null when this item is a carry-over: shows the root entry title as provenance
  origin_entry_title: string | null
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 9)
}

function normalizeStringList(values: string[]) {
  return values.map(v => v.trim()).filter(Boolean)
}

function emptyDeliverable(): DeliverableFormItem {
  return {
    tempId: makeId(),
    description: '',
    status: 'pending',
    completion_date: '',
    notes: '',
    is_carried_over: false,
    origin_deliverable_id: null,
    carried_from_diary_entry_id: null,
    carried_from_entry_title: '',
  }
}

function deliverableFromDb(d: DiaryDeliverable): DeliverableFormItem {
  return {
    tempId: d.id,
    id: d.id,
    description: d.description,
    // Legacy rows with null status are treated as completed (historical entries were all completed)
    status: (d.status as DeliverableStatus | null) ?? 'completed',
    completion_date: d.completion_date ?? '',
    notes: d.notes ?? '',
    is_carried_over: d.is_carried_over,
    origin_deliverable_id: d.origin_deliverable_id ?? null,
    carried_from_diary_entry_id: d.carried_from_diary_entry_id ?? null,
    carried_from_entry_title: '',
  }
}

function DeliverableRow({
  item,
  index,
  total,
  saving,
  onUpdate,
  onRemove,
}: {
  item: DeliverableFormItem
  index: number
  total: number
  saving: boolean
  onUpdate: (tempId: string, patch: Partial<DeliverableFormItem>) => void
  onRemove: (tempId: string) => void
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          {item.is_carried_over && item.carried_from_entry_title && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
              <ArrowRightFromLine size={12} />
              Herdado de: {item.carried_from_entry_title}
            </div>
          )}
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Entregável {index + 1}
            {item.is_carried_over && (
              <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-amber-600 normal-case tracking-normal font-medium">
                herdado
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary px-3 mt-0.5 shrink-0"
          onClick={() => onRemove(item.tempId)}
          disabled={saving || total === 1}
          aria-label="Remover entregável"
        >
          <X size={16} />
        </button>
      </div>

      <textarea
        value={item.description}
        onChange={e => onUpdate(item.tempId, { description: e.target.value })}
        className="input min-h-20 resize-y"
        placeholder="Descreva o entregável desta semana"
        disabled={saving}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label text-xs">Status</label>
          <select
            value={item.status}
            onChange={e => {
              const newStatus = e.target.value as DeliverableStatus
              onUpdate(item.tempId, {
                status: newStatus,
                completion_date: newStatus !== 'completed' ? '' : item.completion_date,
              })
            }}
            className="input"
            disabled={saving}
          >
            <option value="pending">Pendente</option>
            <option value="partial">Parcial</option>
            <option value="completed">Realizado</option>
          </select>
        </div>

        {item.status === 'completed' && (
          <div>
            <label className="label text-xs">Data de realização *</label>
            <input
              type="date"
              value={item.completion_date}
              onChange={e => onUpdate(item.tempId, { completion_date: e.target.value })}
              className="input"
              disabled={saving}
            />
          </div>
        )}
      </div>

      {(item.status === 'partial' || item.status === 'pending') && (
        <div>
          <label className="label text-xs">
            Observação *{' '}
            <span className="normal-case font-normal text-neutral-400">
              ({item.status === 'partial' ? 'o que foi feito parcialmente?' : 'por que está pendente?'})
            </span>
          </label>
          <textarea
            value={item.notes}
            onChange={e => onUpdate(item.tempId, { notes: e.target.value })}
            className="input min-h-16 resize-y"
            placeholder={
              item.status === 'pending'
                ? 'Descreva o motivo da pendência...'
                : 'Descreva o que foi realizado parcialmente...'
            }
            disabled={saving}
          />
        </div>
      )}
    </div>
  )
}

export function DiaryEntryForm({
  mode,
  projects,
  activeProjectId,
  canChooseProject,
  initialData,
  initialDeliverables = [],
}: DiaryEntryFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const initialProjectId = initialData?.project_id ?? activeProjectId ?? ''
  const [projectId, setProjectId] = useState(initialProjectId)
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [titleTouched, setTitleTouched] = useState(Boolean(initialData?.title))
  const [startDate, setStartDate] = useState(initialData?.start_date ?? '')
  const [endDate, setEndDate] = useState(initialData?.end_date ?? '')
  const [fausPeople, setFausPeople] = useState<string[]>(
    initialData?.faus_people?.length ? initialData.faus_people : ['']
  )

  const [deliverables, setDeliverables] = useState<DeliverableFormItem[]>(
    initialDeliverables.length
      ? initialDeliverables
          .sort((a, b) => a.position - b.position)
          .map(deliverableFromDb)
      : [emptyDeliverable()]
  )

  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Pending deliverables carry-over state (create mode only)
  const [pendingOptions, setPendingOptions] = useState<PendingDeliverableOption[]>([])
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set())
  const [loadingPending, setLoadingPending] = useState(false)
  const [showPendingPanel, setShowPendingPanel] = useState(false)

  const selectedProject = useMemo(
    () => projects.find(p => p.id === projectId) ?? null,
    [projectId, projects]
  )

  useEffect(() => {
    if (!startDate || !endDate || titleTouched) return
    setTitle(buildDiaryTitle(startDate, endDate))
  }, [endDate, startDate, titleTouched])

  // Fetch pending deliverables from previous visits when project is selected in create mode
  useEffect(() => {
    if (mode !== 'create' || !projectId) {
      setPendingOptions([])
      setSelectedPendingIds(new Set())
      setShowPendingPanel(false)
      return
    }

    let cancelled = false

    async function fetchPending() {
      setLoadingPending(true)
      try {
        // Fetch all entries for the project (need start_date for recency sorting)
        const { data: entriesRaw, error: entriesErr } = await (supabase as any)
          .from('diary_entries')
          .select('id, title, start_date')
          .eq('project_id', projectId)
          .is('deleted_at', null)
          .order('start_date', { ascending: false })

        if (cancelled) return

        const entries = entriesRaw as Array<{ id: string; title: string; start_date: string }> | null

        if (entriesErr || !entries || entries.length === 0) {
          setPendingOptions([])
          setShowPendingPanel(false)
          return
        }

        const entryIds = entries.map(e => e.id)
        const entryTitleMap = new Map(entries.map(e => [e.id, e.title]))
        const entryDateMap = new Map(entries.map(e => [e.id, e.start_date]))

        // Fetch ALL deliverables (all statuses) — needed to trace carry-over chains
        const { data: delivsRaw, error: delivsErr } = await (supabase as any)
          .from('diary_deliverables')
          .select('id, description, status, notes, diary_entry_id, origin_deliverable_id')
          .in('diary_entry_id', entryIds)

        if (cancelled) return
        if (delivsErr) return

        type RawDeliv = {
          id: string
          description: string
          status: string | null
          notes: string | null
          diary_entry_id: string
          origin_deliverable_id: string | null
        }

        const allDelivs: RawDeliv[] = delivsRaw ?? []

        // Build lookup and parent→children map for chain traversal
        const delivMap = new Map(allDelivs.map(d => [d.id, d]))
        const childrenOf = new Map<string, string[]>()
        allDelivs.forEach(d => {
          if (d.origin_deliverable_id) {
            const ch = childrenOf.get(d.origin_deliverable_id) ?? []
            ch.push(d.id)
            childrenOf.set(d.origin_deliverable_id, ch)
          }
        })

        // BFS: collect all descendant IDs starting from a root
        function collectChainIds(rootId: string): string[] {
          const result: string[] = []
          const queue: string[] = [rootId]
          while (queue.length > 0) {
            const current = queue.shift()!
            result.push(current)
            const children = childrenOf.get(current) ?? []
            queue.push(...children)
          }
          return result
        }

        // Process each chain root (deliverable with no origin_deliverable_id)
        const roots = allDelivs.filter(d => !d.origin_deliverable_id)
        const options: PendingDeliverableOption[] = []

        for (const root of roots) {
          const chainIds = collectChainIds(root.id)
          const chainItems = chainIds.map(id => delivMap.get(id)).filter(Boolean) as RawDeliv[]

          // Rule: if ANY item in the chain is completed, the whole chain is resolved
          if (chainItems.some(item => item.status === 'completed')) continue

          // Collect open items (pending or partial)
          const openItems = chainItems.filter(
            item => item.status === 'pending' || item.status === 'partial'
          )
          if (openItems.length === 0) continue

          // Show only the "leaf" open items — those that have no children in the chain
          // (i.e. the most advanced open occurrence of this pendency)
          const leafOpenItems = openItems.filter(item => !(childrenOf.get(item.id)?.length))
          if (leafOpenItems.length === 0) continue

          // Among leaves, pick the one from the most recent entry
          const best = leafOpenItems.reduce((prev, curr) => {
            const dateA = entryDateMap.get(prev.diary_entry_id) ?? ''
            const dateB = entryDateMap.get(curr.diary_entry_id) ?? ''
            return dateB > dateA ? curr : prev
          })

          options.push({
            id: best.id,
            description: best.description,
            status: best.status as 'pending' | 'partial',
            notes: best.notes ?? null,
            diary_entry_id: best.diary_entry_id,
            entry_title: entryTitleMap.get(best.diary_entry_id) ?? 'Visita anterior',
            // Show root origin only when the selected leaf is not the original item
            origin_entry_title:
              best.diary_entry_id !== root.diary_entry_id
                ? (entryTitleMap.get(root.diary_entry_id) ?? null)
                : null,
          })
        }

        setPendingOptions(options)
        setShowPendingPanel(options.length > 0)
      } finally {
        if (!cancelled) setLoadingPending(false)
      }
    }

    fetchPending()
    return () => { cancelled = true }
  }, [projectId, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateDeliverable(tempId: string, patch: Partial<DeliverableFormItem>) {
    setDeliverables(current =>
      current.map(d => d.tempId === tempId ? { ...d, ...patch } : d)
    )
  }

  function removeDeliverable(tempId: string) {
    setDeliverables(current => current.filter(d => d.tempId !== tempId))
  }

  function addEmptyDeliverable() {
    setDeliverables(current => [...current, emptyDeliverable()])
  }

  function togglePendingSelection(id: string) {
    setSelectedPendingIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addSelectedPendingToForm() {
    const toAdd: DeliverableFormItem[] = pendingOptions
      .filter(opt => selectedPendingIds.has(opt.id))
      .map(opt => ({
        tempId: `carry-${opt.id}`,
        description: opt.description,
        status: 'pending' as DeliverableStatus,
        completion_date: '',
        notes: opt.notes ?? '',
        is_carried_over: true,
        origin_deliverable_id: opt.id,
        carried_from_diary_entry_id: opt.diary_entry_id,
        carried_from_entry_title: opt.entry_title,
      }))

    setDeliverables(current => [...current, ...toAdd])
    setPendingOptions(current => current.filter(opt => !selectedPendingIds.has(opt.id)))
    setSelectedPendingIds(new Set())
    if (pendingOptions.length - selectedPendingIds.size === 0) {
      setShowPendingPanel(false)
    }
  }

  function validate() {
    const nextErrors: FormErrors = {}
    const people = normalizeStringList(fausPeople)

    if (!projectId) nextErrors.project_id = 'Selecione o projeto vinculado.'
    if (!title.trim()) nextErrors.title = 'Informe o título do registro.'
    if (!startDate) nextErrors.start_date = 'Informe a data de início.'
    if (!endDate) nextErrors.end_date = 'Informe a data de fim.'
    if (startDate && endDate && endDate < startDate) {
      nextErrors.end_date = 'A data de fim não pode ser anterior à data de início.'
    }
    if (people.length === 0) nextErrors.faus_people = 'Informe pelo menos uma pessoa FAUS.'

    const validItems = deliverables.filter(d => d.description.trim())
    if (validItems.length === 0) {
      nextErrors.deliverables = 'Informe pelo menos um entregável.'
    } else {
      const deliverableErrors: string[] = []
      validItems.forEach((d, i) => {
        if (d.status === 'completed' && !d.completion_date) {
          deliverableErrors.push(`Entregável ${i + 1}: informe a data de realização.`)
        }
        if ((d.status === 'partial' || d.status === 'pending') && !d.notes.trim()) {
          const label = d.status === 'partial' ? 'Parcial' : 'Pendente'
          deliverableErrors.push(`Entregável ${i + 1}: observação obrigatória para status "${label}".`)
        }
      })
      if (deliverableErrors.length > 0) {
        nextErrors.deliverables = deliverableErrors.join(' ')
      }
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!validate()) return

    setSaving(true)

    const peoplePayload = normalizeStringList(fausPeople)
    const validDeliverables = deliverables.filter(d => d.description.trim())

    try {
      const entriesTable = supabase.from('diary_entries') as any
      const deliverablesTable = supabase.from('diary_deliverables') as any

      if (mode === 'create') {
        const { data: authData } = await supabase.auth.getUser()
        if (!authData.user) {
          throw new Error('Sessão não encontrada. Faça login novamente.')
        }

        const { data, error } = await entriesTable
          .insert({
            project_id: projectId,
            title: title.trim(),
            start_date: startDate,
            end_date: endDate,
            faus_people: peoplePayload,
            created_by: authData.user.id,
          })
          .select('id')
          .single()

        if (error || !data) throw new Error(error?.message ?? 'Não foi possível criar o registro.')

        const entryId = (data as { id: string }).id
        const rows = validDeliverables.map((d, index) => ({
          diary_entry_id: entryId,
          description: d.description.trim(),
          position: index,
          status: d.status,
          completion_date: d.completion_date || null,
          notes: d.notes.trim() || null,
          is_carried_over: d.is_carried_over,
          origin_deliverable_id: d.origin_deliverable_id,
          carried_from_diary_entry_id: d.carried_from_diary_entry_id,
        }))

        const { error: delivErr } = await deliverablesTable.insert(rows)
        if (delivErr) throw new Error(delivErr.message)

        router.push(`/dashboard/diario-de-bordo/${entryId}`)
      } else if (initialData) {
        const { error: updateErr } = await entriesTable
          .update({
            title: title.trim(),
            start_date: startDate,
            end_date: endDate,
            faus_people: peoplePayload,
          })
          .eq('id', initialData.id)

        if (updateErr) throw new Error(updateErr.message)

        // ID-based update: preserve carry-over relationships
        const originalIds = new Set(initialDeliverables.map(d => d.id))
        const itemsWithId = validDeliverables.filter(d => d.id)
        const itemsWithoutId = validDeliverables.filter(d => !d.id)
        const keptIds = new Set(itemsWithId.map(d => d.id!))
        const removedIds = [...originalIds].filter(id => !keptIds.has(id))

        if (removedIds.length > 0) {
          const { error: deleteErr } = await deliverablesTable.delete().in('id', removedIds)
          if (deleteErr) throw new Error(deleteErr.message)
        }

        for (let i = 0; i < validDeliverables.length; i++) {
          const d = validDeliverables[i]
          if (!d.id) continue
          const { error: updErr } = await deliverablesTable
            .update({
              description: d.description.trim(),
              position: i,
              status: d.status,
              completion_date: d.completion_date || null,
              notes: d.notes.trim() || null,
            })
            .eq('id', d.id)
          if (updErr) throw new Error(updErr.message)
        }

        if (itemsWithoutId.length > 0) {
          const newRows = itemsWithoutId.map((d, idx) => ({
            diary_entry_id: initialData.id,
            description: d.description.trim(),
            position: validDeliverables.findIndex(x => x.tempId === d.tempId),
            status: d.status,
            completion_date: d.completion_date || null,
            notes: d.notes.trim() || null,
            is_carried_over: d.is_carried_over,
            origin_deliverable_id: d.origin_deliverable_id,
            carried_from_diary_entry_id: d.carried_from_diary_entry_id,
          }))
          const { error: insertErr } = await deliverablesTable.insert(newRows)
          if (insertErr) throw new Error(insertErr.message)
        }

        router.push(`/dashboard/diario-de-bordo/${initialData.id}`)
      }

      router.refresh()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o registro. Tente novamente.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card p-6 space-y-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="project_id" className="label">
              Projeto *
            </label>
            <select
              id="project_id"
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="input"
              disabled={saving || mode === 'edit' || !canChooseProject}
            >
              <option value="">Selecione um projeto acessível</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.client_name ? `${p.project_name} · ${p.client_name}` : p.project_name}
                </option>
              ))}
            </select>
            {selectedProject && (
              <p className="mt-2 text-xs text-neutral-500">
                {canChooseProject ? 'Projeto selecionado manualmente' : 'Projeto ativo usado automaticamente'}
                {' '}· Cliente: {selectedProject.client_name ?? 'Cliente vinculado'}
              </p>
            )}
            {!selectedProject && canChooseProject && (
              <p className="mt-2 text-xs text-neutral-500">
                Nenhum projeto ativo selecionado. Escolha manualmente um projeto acessível.
              </p>
            )}
            {errors.project_id && <p className="mt-1 text-xs text-red-600">{errors.project_id}</p>}
          </div>

          <div>
            <label htmlFor="start_date" className="label">
              Data de início *
            </label>
            <input
              id="start_date"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="input"
              disabled={saving}
            />
            {errors.start_date && <p className="mt-1 text-xs text-red-600">{errors.start_date}</p>}
          </div>

          <div>
            <label htmlFor="end_date" className="label">
              Data de fim *
            </label>
            <input
              id="end_date"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="input"
              disabled={saving}
            />
            {errors.end_date && <p className="mt-1 text-xs text-red-600">{errors.end_date}</p>}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="title" className="label">
              Título *
            </label>
            <input
              id="title"
              value={title}
              onChange={e => {
                setTitle(e.target.value)
                setTitleTouched(true)
              }}
              className="input"
              placeholder="Visita de DD/MM/AAAA até DD/MM/AAAA"
              disabled={saving}
            />
            <p className="mt-2 text-xs text-neutral-500">
              Sugerido automaticamente pelas datas; pode ser ajustado.
            </p>
            {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
          </div>

          <div className="md:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="label mb-0">Pessoas da FAUS *</label>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setFausPeople(current => [...current, ''])}
                disabled={saving}
              >
                <Plus size={15} />
                Adicionar pessoa
              </button>
            </div>
            <div className="space-y-2">
              {fausPeople.map((person, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    value={person}
                    onChange={e => setFausPeople(current =>
                      current.map((p, i) => i === index ? e.target.value : p)
                    )}
                    className="input"
                    placeholder="Nome da pessoa FAUS"
                    disabled={saving}
                  />
                  <button
                    type="button"
                    className="btn-secondary px-3"
                    onClick={() => setFausPeople(current => current.filter((_, i) => i !== index))}
                    disabled={saving || fausPeople.length === 1}
                    aria-label="Remover pessoa"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            {errors.faus_people && <p className="mt-1 text-xs text-red-600">{errors.faus_people}</p>}
          </div>
        </div>
      </div>

      {/* Pending deliverables carry-over panel (create mode only) */}
      {mode === 'create' && (loadingPending || showPendingPanel) && (
        <div className="card p-6 space-y-4 border-amber-200 bg-amber-50/40">
          <div className="flex items-start gap-2">
            <ArrowRightFromLine size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                Pendências de visitas anteriores
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Existem entregáveis pendentes/parciais de visitas anteriores. Selecione os que deseja adicionar a esta visita.
              </p>
            </div>
          </div>

          {loadingPending ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 size={14} className="animate-spin" />
              Verificando pendências anteriores...
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {pendingOptions.map(opt => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3 hover:bg-neutral-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPendingIds.has(opt.id)}
                      onChange={() => togglePendingSelection(opt.id)}
                      className="mt-0.5 shrink-0"
                      disabled={saving}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-800">{opt.description}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          opt.status === 'partial'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                        }`}>
                          {opt.status === 'partial' ? 'Parcial' : 'Pendente'}
                        </span>
                        <span className="text-xs text-neutral-400">{opt.entry_title}</span>
                        {opt.origin_entry_title && (
                          <span className="text-xs text-neutral-300">
                            · Origem: {opt.origin_entry_title}
                          </span>
                        )}
                      </div>
                      {opt.notes && (
                        <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{opt.notes}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-neutral-500">
                  {selectedPendingIds.size} de {pendingOptions.length} selecionado(s)
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={addSelectedPendingToForm}
                  disabled={saving || selectedPendingIds.size === 0}
                >
                  <Plus size={15} />
                  Adicionar selecionados à visita
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Deliverables section */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Entregáveis da semana *</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Defina o status de cada entregável e preencha observações quando necessário.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary shrink-0"
            onClick={addEmptyDeliverable}
            disabled={saving}
          >
            <Plus size={15} />
            Adicionar entregável
          </button>
        </div>

        <div className="space-y-3">
          {deliverables.map((item, index) => (
            <DeliverableRow
              key={item.tempId}
              item={item}
              index={index}
              total={deliverables.length}
              saving={saving}
              onUpdate={updateDeliverable}
              onRemove={removeDeliverable}
            />
          ))}
        </div>

        {errors.deliverables && (
          <p className="text-xs text-red-600">{errors.deliverables}</p>
        )}
      </div>

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link
          href={initialData ? `/dashboard/diario-de-bordo/${initialData.id}` : '/dashboard/diario-de-bordo'}
          className="btn-secondary"
        >
          Cancelar
        </Link>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving && <Loader2 size={16} className="animate-spin" />}
          {mode === 'create' ? 'Registrar dedicação' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}
