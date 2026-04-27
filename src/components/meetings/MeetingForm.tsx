'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MEETING_TYPE_LABELS } from '@/lib/utils'
import type {
  InsertDto,
  Meeting,
  MeetingType,
  UpdateDto,
} from '@/types/database.types'

interface ProjectOption {
  id: string
  project_name: string
}

interface MeetingFormProps {
  mode: 'create' | 'edit'
  initialData?: Meeting
  projects: ProjectOption[]
  canChooseProject: boolean
}

interface FormErrors {
  project_id?: string
  meeting_date?: string
  participants?: string
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function MeetingForm({
  mode,
  initialData,
  projects,
  canChooseProject,
}: MeetingFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [projectId, setProjectId] = useState(initialData?.project_id ?? projects[0]?.id ?? '')
  const [meetingType, setMeetingType] = useState<MeetingType>(initialData?.meeting_type ?? 'followup')
  const [meetingDate, setMeetingDate] = useState(toDateTimeLocal(initialData?.meeting_date))
  const [participants, setParticipants] = useState<string[]>(initialData?.participants ?? [])
  const [participantInput, setParticipantInput] = useState('')
  const [executiveSummary, setExecutiveSummary] = useState(initialData?.executive_summary ?? '')
  const [decisionsMade, setDecisionsMade] = useState(initialData?.decisions_made ?? '')
  const [nextSteps, setNextSteps] = useState(initialData?.next_steps ?? '')
  const [visibleToClient, setVisibleToClient] = useState(initialData?.visible_to_client ?? false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const meetingTypeOptions = useMemo(
    () => Object.entries(MEETING_TYPE_LABELS) as [MeetingType, string][],
    []
  )

  function validate() {
    const nextErrors: FormErrors = {}

    if (!projectId) nextErrors.project_id = 'Selecione o projeto vinculado.'
    if (!meetingDate) nextErrors.meeting_date = 'Informe a data e hora da reunião.'
    if (participants.length > 50) nextErrors.participants = 'O limite é de 50 participantes por reunião.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!validate()) return

    setSaving(true)

    const meetingDateValue = new Date(meetingDate).toISOString()
    const participantsValue = participants.length > 0 ? participants : null
    const executiveSummaryValue = executiveSummary.trim() || null
    const decisionsMadeValue = decisionsMade.trim() || null
    const nextStepsValue = nextSteps.trim() || null

    const updatePayload: UpdateDto<'meetings'> = {
      meeting_date: meetingDateValue,
      meeting_type: meetingType,
      participants: participantsValue,
      executive_summary: executiveSummaryValue,
      decisions_made: decisionsMadeValue,
      next_steps: nextStepsValue,
      visible_to_client: visibleToClient,
    }

    try {
      const meetingsTable = supabase.from('meetings') as any

      if (mode === 'create') {
        const { data: authData } = await supabase.auth.getUser()
        const insertPayload: InsertDto<'meetings'> = {
          project_id: projectId,
          meeting_date: meetingDateValue,
          meeting_type: meetingType,
          participants: participantsValue,
          executive_summary: executiveSummaryValue,
          decisions_made: decisionsMadeValue,
          next_steps: nextStepsValue,
          visible_to_client: visibleToClient,
          created_by: authData.user?.id ?? null,
        }

        const { data, error } = await meetingsTable
          .insert(insertPayload)
          .select('id')
          .single()

        if (error || !data) {
          throw new Error(error?.message ?? 'Não foi possível criar a reunião.')
        }

        router.push(`/dashboard/reunioes/${(data as { id: string }).id}`)
      } else if (initialData) {
        const { data, error } = await meetingsTable
          .update(updatePayload)
          .eq('id', initialData.id)
          .select('id')
          .single()

        if (error || !data) {
          throw new Error(error?.message ?? 'Não foi possível atualizar a reunião.')
        }

        router.push(`/dashboard/reunioes/${(data as { id: string }).id}`)
      }

      router.refresh()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a reunião. Tente novamente.'
      )
    } finally {
      setSaving(false)
    }
  }

  function handleAddParticipant() {
    const nextParticipant = participantInput.trim()
    if (!nextParticipant) return

    if (participants.length >= 50) {
      setErrors(current => ({ ...current, participants: 'O limite é de 50 participantes por reunião.' }))
      return
    }

    if (participants.includes(nextParticipant)) {
      setParticipantInput('')
      return
    }

    setParticipants(current => [...current, nextParticipant])
    setParticipantInput('')
    setErrors(current => ({ ...current, participants: undefined }))
  }

  function handleRemoveParticipant(participant: string) {
    setParticipants(current => current.filter(item => item !== participant))
    setErrors(current => ({ ...current, participants: undefined }))
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
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
            <option value="">Selecione</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.project_name}
              </option>
            ))}
          </select>
          {errors.project_id && <p className="mt-1 text-xs text-red-600">{errors.project_id}</p>}
        </div>

        <div>
          <label htmlFor="meeting_type" className="label">
            Tipo de reunião
          </label>
          <select
            id="meeting_type"
            value={meetingType}
            onChange={event => setMeetingType(event.target.value as MeetingType)}
            className="input"
            disabled={saving}
          >
            {meetingTypeOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="meeting_date" className="label">
            Data e hora *
          </label>
          <input
            id="meeting_date"
            type="datetime-local"
            value={meetingDate}
            onChange={event => setMeetingDate(event.target.value)}
            className="input"
            disabled={saving}
          />
          {errors.meeting_date && <p className="mt-1 text-xs text-red-600">{errors.meeting_date}</p>}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="participant_input" className="label">
            Participantes
          </label>
          <div className="flex gap-2">
            <input
              id="participant_input"
              value={participantInput}
              onChange={event => setParticipantInput(event.target.value)}
              className="input"
              placeholder="Nome, e-mail ou referência do participante"
              disabled={saving || participants.length >= 50}
            />
            <button
              type="button"
              className="btn-secondary whitespace-nowrap"
              onClick={handleAddParticipant}
              disabled={saving || !participantInput.trim() || participants.length >= 50}
            >
              Adicionar
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            Até 50 participantes. Cada item é salvo individualmente na reunião.
          </p>
          {errors.participants && <p className="mt-1 text-xs text-red-600">{errors.participants}</p>}
          {participants.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {participants.map(participant => (
                <span key={participant} className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">
                  {participant}
                  <button
                    type="button"
                    className="text-neutral-400 hover:text-red-600"
                    onClick={() => handleRemoveParticipant(participant)}
                    disabled={saving}
                    aria-label={`Remover ${participant}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="executive_summary" className="label">
            Resumo executivo
          </label>
          <textarea
            id="executive_summary"
            value={executiveSummary}
            onChange={event => setExecutiveSummary(event.target.value)}
            className="input min-h-28 resize-y"
            placeholder="Síntese objetiva dos principais pontos tratados."
            disabled={saving}
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="decisions_made" className="label">
            Decisões tomadas
          </label>
          <textarea
            id="decisions_made"
            value={decisionsMade}
            onChange={event => setDecisionsMade(event.target.value)}
            className="input min-h-24 resize-y"
            placeholder="Registre as definições e alinhamentos fechados na reunião."
            disabled={saving}
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="next_steps" className="label">
            Próximos passos
          </label>
          <textarea
            id="next_steps"
            value={nextSteps}
            onChange={event => setNextSteps(event.target.value)}
            className="input min-h-24 resize-y"
            placeholder="Descreva próximos passos, encaminhamentos e responsáveis."
            disabled={saving}
          />
        </div>

        <div className="md:col-span-2">
          <label className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <input
              type="checkbox"
              checked={visibleToClient}
              onChange={event => setVisibleToClient(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              disabled={saving}
            />
            <span>
              <span className="block text-sm font-medium text-neutral-800">Visível no portal do cliente</span>
              <span className="mt-1 block text-xs text-neutral-500">
                Habilite quando o registro puder aparecer também no acompanhamento externo do cliente.
              </span>
            </span>
          </label>
        </div>
      </div>

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href={initialData ? `/dashboard/reunioes/${initialData.id}` : '/dashboard/reunioes'} className="btn-secondary">
          Cancelar
        </Link>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving && <Loader2 size={16} className="animate-spin" />}
          {mode === 'create' ? 'Criar reunião' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}
