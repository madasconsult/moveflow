'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PROJECT_SPECIALTY_LABELS } from '@/lib/utils'
import type { ProjectMemberRole, ProjectSpecialty } from '@/types/database.types'

interface SupportProfile {
  id: string
  full_name: string
  email: string
}

interface SupportMember {
  id: string
  project_id: string
  user_id: string
  role_in_project: ProjectMemberRole
  specialty: ProjectSpecialty | null
  added_by: string | null
  created_at: string
  profile: SupportProfile | null
}

interface ProjectSupportTeamManagerProps {
  projectId: string
  mainConsultantId: string | null
  currentUserId: string
  canManage: boolean
  supportMembers: SupportMember[]
  eligibleUsers: SupportProfile[]
}

const MAX_SUPPORT_MEMBERS = 5

const SPECIALTY_OPTIONS = (Object.entries(PROJECT_SPECIALTY_LABELS) as [ProjectSpecialty, string][])
  .sort(([, firstLabel], [, secondLabel]) => firstLabel.localeCompare(secondLabel, 'pt-BR'))

export function ProjectSupportTeamManager({
  projectId,
  mainConsultantId,
  currentUserId,
  canManage,
  supportMembers,
  eligibleUsers,
}: ProjectSupportTeamManagerProps) {
  const router = useRouter()
  const supabase = createClient()
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedSpecialty, setSelectedSpecialty] = useState<ProjectSpecialty | ''>('')
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const orderedMembers = useMemo(
    () =>
      [...supportMembers].sort((firstMember, secondMember) =>
        (firstMember.profile?.full_name ?? 'Usuário vinculado').localeCompare(
          secondMember.profile?.full_name ?? 'Usuário vinculado',
          'pt-BR'
        )
      ),
    [supportMembers]
  )

  const selectedSupportIds = useMemo(
    () => new Set(supportMembers.map(member => member.user_id)),
    [supportMembers]
  )

  const availableUsers = useMemo(
    () =>
      eligibleUsers.filter(user =>
        user.id !== mainConsultantId &&
        !selectedSupportIds.has(user.id)
      ),
    [eligibleUsers, mainConsultantId, selectedSupportIds]
  )

  async function addSupportMember() {
    setError(null)
    setMessage(null)

    if (!canManage) return
    if (supportMembers.length >= MAX_SUPPORT_MEMBERS) {
      setError('O projeto já possui o limite de 5 consultores de suporte.')
      return
    }
    if (!selectedUserId) {
      setError('Selecione um consultor para suporte.')
      return
    }
    if (selectedUserId === mainConsultantId) {
      setError('O consultor principal não pode ser adicionado como suporte.')
      return
    }
    if (selectedSupportIds.has(selectedUserId)) {
      setError('Este usuário já está na equipe de suporte do projeto.')
      return
    }
    if (!selectedSpecialty) {
      setError('Selecione a especialidade do consultor de suporte.')
      return
    }

    setSaving(true)

    try {
      const projectMembersTable = supabase.from('project_members') as any
      const { error: insertError } = await projectMembersTable
        .insert({
          project_id: projectId,
          user_id: selectedUserId,
          role_in_project: 'support',
          specialty: selectedSpecialty,
          added_by: currentUserId,
        })

      if (insertError) throw new Error(insertError.message)

      setSelectedUserId('')
      setSelectedSpecialty('')
      setMessage('Consultor de suporte adicionado com sucesso.')
      router.refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Não foi possível adicionar o suporte.')
    } finally {
      setSaving(false)
    }
  }

  async function updateSpecialty(memberId: string, specialty: ProjectSpecialty) {
    setError(null)
    setMessage(null)
    setUpdatingId(memberId)

    try {
      const projectMembersTable = supabase.from('project_members') as any
      const { error: updateError } = await projectMembersTable
        .update({ specialty })
        .eq('id', memberId)
        .eq('project_id', projectId)
        .eq('role_in_project', 'support')

      if (updateError) throw new Error(updateError.message)

      setMessage('Especialidade atualizada com sucesso.')
      router.refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Não foi possível atualizar a especialidade.')
    } finally {
      setUpdatingId(null)
    }
  }

  async function removeSupportMember(memberId: string) {
    setError(null)
    setMessage(null)
    setRemovingId(memberId)

    try {
      const projectMembersTable = supabase.from('project_members') as any
      const { error: deleteError } = await projectMembersTable
        .delete()
        .eq('id', memberId)
        .eq('project_id', projectId)
        .eq('role_in_project', 'support')

      if (deleteError) throw new Error(deleteError.message)

      setMessage('Consultor de suporte removido com sucesso.')
      router.refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Não foi possível remover o suporte.')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Equipe de suporte</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Consultores de apoio do projeto e suas especialidades operacionais.
          </p>
        </div>
        <span className="badge bg-neutral-100 text-neutral-600">
          {orderedMembers.length}/{MAX_SUPPORT_MEMBERS} suportes
        </span>
      </div>

      {(error || message) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            error
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {error ?? message}
        </div>
      )}

      {canManage && (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div>
              <label htmlFor="support_user_id" className="label">
                Consultor de suporte
              </label>
              <select
                id="support_user_id"
                value={selectedUserId}
                onChange={event => setSelectedUserId(event.target.value)}
                className="input"
                disabled={saving || orderedMembers.length >= MAX_SUPPORT_MEMBERS}
              >
                <option value="">Selecione</option>
                {availableUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="support_specialty" className="label">
                Especialidade
              </label>
              <select
                id="support_specialty"
                value={selectedSpecialty}
                onChange={event => setSelectedSpecialty(event.target.value as ProjectSpecialty | '')}
                className="input"
                disabled={saving || orderedMembers.length >= MAX_SUPPORT_MEMBERS}
              >
                <option value="">Selecione</option>
                {SPECIALTY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn-primary h-11"
              onClick={addSupportMember}
              disabled={saving || orderedMembers.length >= MAX_SUPPORT_MEMBERS}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Adicionar suporte
            </button>
          </div>

          {orderedMembers.length >= MAX_SUPPORT_MEMBERS && (
            <p className="mt-3 text-xs text-amber-700">
              Limite de 5 consultores de suporte atingido para este projeto.
            </p>
          )}
        </div>
      )}

      {orderedMembers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500">
          Nenhum consultor de suporte cadastrado para este projeto.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-3">Consultor</th>
                <th className="px-4 py-3">Especialidade</th>
                {canManage && <th className="px-4 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {orderedMembers.map(member => {
                const isUpdating = updatingId === member.id
                const isRemoving = removingId === member.id

                return (
                  <tr key={member.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-4">
                      <p className="font-medium text-neutral-900">
                        {member.profile?.full_name ?? 'Usuário vinculado'}
                      </p>
                      {member.profile?.email && (
                        <p className="mt-1 text-xs text-neutral-500">{member.profile.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {canManage ? (
                        <select
                          value={member.specialty ?? ''}
                          onChange={event => updateSpecialty(member.id, event.target.value as ProjectSpecialty)}
                          className="input h-10 min-w-[220px]"
                          disabled={isUpdating || isRemoving}
                        >
                          <option value="" disabled>
                            Selecione
                          </option>
                          {SPECIALTY_OPTIONS.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="badge bg-neutral-100 text-neutral-700">
                          {member.specialty ? PROJECT_SPECIALTY_LABELS[member.specialty] : 'Não definida'}
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-4 py-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => removeSupportMember(member.id)}
                            disabled={isUpdating || isRemoving}
                          >
                            {isRemoving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            Remover
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
