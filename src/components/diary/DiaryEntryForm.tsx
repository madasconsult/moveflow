'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { buildDiaryTitle } from '@/lib/diary-board'
import type { DiaryDeliverable, DiaryEntry, InsertDto, UpdateDto } from '@/types/database.types'

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

function normalizeList(values: string[]) {
  return values.map(value => value.trim()).filter(Boolean)
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
  const [deliverables, setDeliverables] = useState<string[]>(
    initialDeliverables.length
      ? initialDeliverables
        .sort((left, right) => left.position - right.position)
        .map(deliverable => deliverable.description)
      : ['']
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedProject = useMemo(
    () => projects.find(project => project.id === projectId) ?? null,
    [projectId, projects]
  )

  useEffect(() => {
    if (!startDate || !endDate || titleTouched) return
    setTitle(buildDiaryTitle(startDate, endDate))
  }, [endDate, startDate, titleTouched])

  function validate() {
    const nextErrors: FormErrors = {}
    const people = normalizeList(fausPeople)
    const deliverableRows = normalizeList(deliverables)

    if (!projectId) nextErrors.project_id = 'Selecione o projeto vinculado.'
    if (!title.trim()) nextErrors.title = 'Informe o título do registro.'
    if (!startDate) nextErrors.start_date = 'Informe a data de início.'
    if (!endDate) nextErrors.end_date = 'Informe a data de fim.'
    if (startDate && endDate && endDate < startDate) {
      nextErrors.end_date = 'A data de fim não pode ser anterior à data de início.'
    }
    if (people.length === 0) nextErrors.faus_people = 'Informe pelo menos uma pessoa FAUS.'
    if (deliverableRows.length === 0) nextErrors.deliverables = 'Informe pelo menos um entregável.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function updatePerson(index: number, value: string) {
    setFausPeople(current => current.map((person, currentIndex) => currentIndex === index ? value : person))
  }

  function updateDeliverable(index: number, value: string) {
    setDeliverables(current => current.map((deliverable, currentIndex) => currentIndex === index ? value : deliverable))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!validate()) return

    setSaving(true)

    const peoplePayload = normalizeList(fausPeople)
    const deliverablesPayload = normalizeList(deliverables)

    try {
      const entriesTable = supabase.from('diary_entries') as any
      const deliverablesTable = supabase.from('diary_deliverables') as any

      if (mode === 'create') {
        const { data: authData } = await supabase.auth.getUser()
        if (!authData.user) {
          throw new Error('Sessão não encontrada. Faça login novamente para registrar a dedicação.')
        }

        const insertPayload: InsertDto<'diary_entries'> = {
          project_id: projectId,
          title: title.trim(),
          start_date: startDate,
          end_date: endDate,
          faus_people: peoplePayload,
          created_by: authData.user.id,
        }

        const { data, error } = await entriesTable
          .insert(insertPayload)
          .select('id')
          .single()

        if (error || !data) {
          throw new Error(error?.message ?? 'Não foi possível criar o registro.')
        }

        const entryId = (data as { id: string }).id
        const deliverableRows: InsertDto<'diary_deliverables'>[] = deliverablesPayload.map((description, index) => ({
          diary_entry_id: entryId,
          description,
          position: index,
        }))

        const { error: deliverablesError } = await deliverablesTable.insert(deliverableRows)
        if (deliverablesError) throw new Error(deliverablesError.message)

        router.push(`/dashboard/diario-de-bordo/${entryId}`)
      } else if (initialData) {
        const updatePayload: UpdateDto<'diary_entries'> = {
          title: title.trim(),
          start_date: startDate,
          end_date: endDate,
          faus_people: peoplePayload,
        }

        const { error } = await entriesTable
          .update(updatePayload)
          .eq('id', initialData.id)

        if (error) throw new Error(error.message)

        const { error: deleteError } = await deliverablesTable
          .delete()
          .eq('diary_entry_id', initialData.id)

        if (deleteError) throw new Error(deleteError.message)

        const deliverableRows: InsertDto<'diary_deliverables'>[] = deliverablesPayload.map((description, index) => ({
          diary_entry_id: initialData.id,
          description,
          position: index,
        }))

        const { error: insertError } = await deliverablesTable.insert(deliverableRows)
        if (insertError) throw new Error(insertError.message)

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
    <form onSubmit={handleSubmit} className="card p-6 space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="project_id" className="label">
            Projeto *
          </label>
          <select
            id="project_id"
            value={projectId}
            onChange={event => setProjectId(event.target.value)}
            className="input"
            disabled={saving || mode === 'edit' || !canChooseProject}
          >
            <option value="">Selecione um projeto acessível</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.client_name ? `${project.project_name} · ${project.client_name}` : project.project_name}
              </option>
            ))}
          </select>
          {selectedProject && (
            <p className="mt-2 text-xs text-neutral-500">
              {canChooseProject
                ? 'Projeto selecionado manualmente'
                : 'Projeto ativo usado automaticamente'}
              {' '}· Cliente: {selectedProject.client_name ?? 'Cliente vinculado'}
            </p>
          )}
          {!selectedProject && canChooseProject && (
            <p className="mt-2 text-xs text-neutral-500">
              Nenhum projeto ativo selecionado. Escolha manualmente um projeto acessível para registrar a dedicação.
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
            onChange={event => setStartDate(event.target.value)}
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
            onChange={event => setEndDate(event.target.value)}
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
            onChange={event => {
              setTitle(event.target.value)
              setTitleTouched(true)
            }}
            className="input"
            placeholder="Visita de DD/MM/AAAA até DD/MM/AAAA"
            disabled={saving}
          />
          <p className="mt-2 text-xs text-neutral-500">
            O título é sugerido automaticamente pelas datas, mas pode ser ajustado.
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
                  onChange={event => updatePerson(index, event.target.value)}
                  className="input"
                  placeholder="Nome da pessoa FAUS"
                  disabled={saving}
                />
                <button
                  type="button"
                  className="btn-secondary px-3"
                  onClick={() => setFausPeople(current => current.filter((_, currentIndex) => currentIndex !== index))}
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

        <div className="md:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-3">
            <label className="label mb-0">Entregáveis da semana *</label>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setDeliverables(current => [...current, ''])}
              disabled={saving}
            >
              <Plus size={15} />
              Adicionar entregável
            </button>
          </div>
          <div className="space-y-2">
            {deliverables.map((deliverable, index) => (
              <div key={index} className="flex items-start gap-2">
                <textarea
                  value={deliverable}
                  onChange={event => updateDeliverable(index, event.target.value)}
                  className="input min-h-20 resize-y"
                  placeholder="Descreva o entregável resumido da semana"
                  disabled={saving}
                />
                <button
                  type="button"
                  className="btn-secondary mt-1 px-3"
                  onClick={() => setDeliverables(current => current.filter((_, currentIndex) => currentIndex !== index))}
                  disabled={saving || deliverables.length === 1}
                  aria-label="Remover entregável"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          {errors.deliverables && <p className="mt-1 text-xs text-red-600">{errors.deliverables}</p>}
        </div>
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
