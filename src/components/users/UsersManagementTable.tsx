'use client'

import { useMemo, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { FAUS_BRANCH_LABELS, ROLE_LABELS, formatDate, isInternalRole } from '@/lib/utils'
import type { FausBranch, Profile, UserRole } from '@/types/database.types'

type UserRow = Pick<
  Profile,
  'id' | 'full_name' | 'email' | 'role' | 'branch' | 'client_id' | 'is_active' | 'created_at'
>

interface ClientOption {
  id: string
  company_name: string
}

interface UsersManagementTableProps {
  users: UserRow[]
  clients: ClientOption[]
}

interface DraftState {
  full_name: string
  role: UserRole
  branch: FausBranch | null
  client_id: string | null
  is_active: boolean
}

const ORIGINAL_ADMIN_ID = '8ba21d13-8ceb-4695-b591-126ff320e6f8'

const ROLE_OPTIONS: UserRole[] = [...(['admin_faus', 'consultor_faus', 'gestor_faus', 'cliente'] as UserRole[])]
  .sort((firstRole, secondRole) => ROLE_LABELS[firstRole].localeCompare(ROLE_LABELS[secondRole], 'pt-BR'))

const BRANCH_OPTIONS = (Object.keys(FAUS_BRANCH_LABELS) as FausBranch[])
  .sort((firstBranch, secondBranch) =>
    FAUS_BRANCH_LABELS[firstBranch].localeCompare(FAUS_BRANCH_LABELS[secondBranch], 'pt-BR')
  )

function normalizeDraft(draft: DraftState): DraftState {
  const isClientRole = draft.role === 'cliente'

  return {
    ...draft,
    full_name: draft.full_name.trim(),
    branch: isClientRole ? null : draft.branch,
    client_id: isClientRole ? draft.client_id : null,
  }
}

function normalizeOriginalAdminDraft(draft: DraftState): DraftState {
  return {
    ...draft,
    role: 'admin_faus',
    client_id: null,
    is_active: true,
  }
}

export function UsersManagementTable({ users, clients }: UsersManagementTableProps) {
  const supabase = createClient()
  const [drafts, setDrafts] = useState<Record<string, DraftState>>(
    Object.fromEntries(
      users.map(user => [
        user.id,
        {
          full_name: user.full_name,
          role: user.id === ORIGINAL_ADMIN_ID ? 'admin_faus' : user.role,
          branch: isInternalRole(user.role) ? user.branch : null,
          client_id: user.id === ORIGINAL_ADMIN_ID ? null : user.role === 'cliente' ? user.client_id : null,
          is_active: user.id === ORIGINAL_ADMIN_ID ? true : user.is_active,
        },
      ])
    )
  )
  const [savingId, setSavingId] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sortedClients = useMemo(
    () =>
      [...clients].sort((firstClient, secondClient) =>
        firstClient.company_name.localeCompare(secondClient.company_name, 'pt-BR')
      ),
    [clients]
  )

  const changedIds = useMemo(
    () =>
      new Set(
        users
          .filter(user => {
            const draft = drafts[user.id]
            if (!draft) return false
            const normalizedDraft = normalizeDraft(draft)

            return (
              normalizedDraft.full_name !== user.full_name ||
              normalizedDraft.role !== user.role ||
              normalizedDraft.branch !== user.branch ||
              normalizedDraft.client_id !== user.client_id ||
              normalizedDraft.is_active !== user.is_active
            )
          })
          .map(user => user.id)
      ),
    [drafts, users]
  )

  function updateDraft(userId: string, nextDraft: DraftState) {
    setDrafts(current => ({
      ...current,
      [userId]: nextDraft,
    }))
    setSuccessId(null)
    setError(null)
  }

  function updateRole(userId: string, draft: DraftState, role: UserRole) {
    if (userId === ORIGINAL_ADMIN_ID) return

    updateDraft(userId, {
      ...draft,
      role,
      branch: role === 'cliente' ? null : draft.branch,
      client_id: role === 'cliente' ? draft.client_id : null,
    })
  }

  async function handleSave(user: UserRow) {
    const draft = drafts[user.id]
    if (!draft) return
    const baseNormalizedDraft = normalizeDraft(draft)

    if (
      user.id === ORIGINAL_ADMIN_ID &&
      (
        baseNormalizedDraft.role !== 'admin_faus' ||
        baseNormalizedDraft.is_active !== true ||
        baseNormalizedDraft.client_id !== null
      )
    ) {
      setError('O Admin Original do MOVE FLOW não pode ser rebaixado, desativado ou vinculado a cliente.')
      return
    }

    const normalizedDraft = user.id === ORIGINAL_ADMIN_ID
      ? normalizeOriginalAdminDraft(baseNormalizedDraft)
      : baseNormalizedDraft

    if (!normalizedDraft.full_name) {
      setError('O nome do usuário não pode ficar vazio.')
      return
    }

    if (normalizedDraft.role === 'cliente' && !normalizedDraft.client_id) {
      setError('Selecione o cliente vinculado para usuários com perfil Cliente.')
      return
    }

    if (isInternalRole(normalizedDraft.role) && !normalizedDraft.branch) {
      setError('Selecione a filial para usuários internos da FAUS.')
      return
    }

    setSavingId(user.id)
    setSuccessId(null)
    setError(null)

    try {
      const { error: updateError } = await (supabase.from('profiles') as any)
        .update({
          full_name: normalizedDraft.full_name,
          role: normalizedDraft.role,
          branch: normalizedDraft.branch,
          client_id: normalizedDraft.client_id,
          is_active: normalizedDraft.is_active,
        })
        .eq('id', user.id)

      if (updateError) throw new Error(updateError.message)

      setSuccessId(user.id)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Não foi possível atualizar o perfil.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="card overflow-hidden">
      {(error || successId) && (
        <div
          className={`border-b px-5 py-3 text-sm ${
            error
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {error ?? 'Perfil atualizado com sucesso.'}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-5 py-3">Nome</th>
              <th className="px-5 py-3">E-mail</th>
              <th className="px-5 py-3">Perfil</th>
              <th className="px-5 py-3">Filial</th>
              <th className="px-5 py-3">Cliente vinculado</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Criado em</th>
              <th className="px-5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {users.map(user => {
              const draft = drafts[user.id]
              const isSaving = savingId === user.id
              const isOriginalAdmin = user.id === ORIGINAL_ADMIN_ID
              const hasChanges = changedIds.has(user.id) && draft.full_name.trim().length > 0

              return (
                <tr key={user.id} className="transition-colors hover:bg-neutral-50">
                  <td className="px-5 py-4">
                    <input
                      value={draft.full_name}
                      onChange={event =>
                        updateDraft(user.id, {
                          ...draft,
                          full_name: event.target.value,
                        })
                      }
                      className="input h-10 min-w-[240px]"
                      disabled={isSaving}
                    />
                  </td>
                  <td className="px-5 py-4 text-neutral-700">{user.email}</td>
                  <td className="px-5 py-4">
                    <div className="space-y-2">
                      <select
                        value={isOriginalAdmin ? 'admin_faus' : draft.role}
                        onChange={event => updateRole(user.id, draft, event.target.value as UserRole)}
                        className="input h-10 min-w-[220px]"
                        disabled={isSaving || isOriginalAdmin}
                      >
                        {ROLE_OPTIONS.map(role => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                      {isOriginalAdmin && (
                        <span className="badge bg-cyan-50 text-cyan-700">Admin Original</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {isInternalRole(draft.role) ? (
                      <select
                        value={draft.branch ?? ''}
                        onChange={event =>
                          updateDraft(user.id, {
                            ...draft,
                            branch: event.target.value ? (event.target.value as FausBranch) : null,
                            client_id: null,
                          })
                        }
                        className="input h-10 min-w-[210px]"
                        disabled={isSaving}
                      >
                        <option value="">Selecione a filial</option>
                        {BRANCH_OPTIONS.map(branch => (
                          <option key={branch} value={branch}>
                            {FAUS_BRANCH_LABELS[branch]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-neutral-400">Não se aplica</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {draft.role === 'cliente' ? (
                      <select
                        value={draft.client_id ?? ''}
                        onChange={event =>
                          updateDraft(user.id, {
                            ...draft,
                            branch: null,
                            client_id: event.target.value || null,
                          })
                        }
                        className="input h-10 min-w-[260px]"
                        disabled={isSaving}
                      >
                        <option value="">Selecione o cliente</option>
                        {sortedClients.map(client => (
                          <option key={client.id} value={client.id}>
                            {client.company_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-neutral-400">Não se aplica</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={isOriginalAdmin || draft.is_active ? 'active' : 'inactive'}
                      onChange={event =>
                        updateDraft(user.id, {
                          ...draft,
                          is_active: event.target.value === 'active',
                        })
                      }
                      className="input h-10 min-w-[160px]"
                      disabled={isSaving || isOriginalAdmin}
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </td>
                  <td className="px-5 py-4 text-neutral-700">{formatDate(user.created_at)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-3">
                      <span
                        className={`badge ${
                          isOriginalAdmin || draft.is_active
                            ? 'bg-green-50 text-green-700'
                            : 'bg-neutral-100 text-neutral-500'
                        }`}
                      >
                        {isOriginalAdmin || draft.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleSave(user)}
                        disabled={isSaving || !hasChanges}
                      >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {isSaving ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
