'use client'

import { useMemo, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ROLE_LABELS, formatDate } from '@/lib/utils'
import type { Profile, UserRole } from '@/types/database.types'

type UserRow = Pick<
  Profile,
  'id' | 'full_name' | 'email' | 'role' | 'is_active' | 'created_at'
>

interface UsersManagementTableProps {
  users: UserRow[]
}

interface DraftState {
  full_name: string
  role: UserRole
  is_active: boolean
}

const ROLE_OPTIONS: UserRole[] = ['admin_faus', 'consultor_faus', 'cliente']

export function UsersManagementTable({ users }: UsersManagementTableProps) {
  const supabase = createClient()
  const [drafts, setDrafts] = useState<Record<string, DraftState>>(
    Object.fromEntries(
      users.map(user => [
        user.id,
        {
          full_name: user.full_name,
          role: user.role,
          is_active: user.is_active,
        },
      ])
    )
  )
  const [savingId, setSavingId] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const changedIds = useMemo(
    () =>
      new Set(
        users
          .filter(user => {
            const draft = drafts[user.id]
            return (
              draft &&
              (
                draft.full_name !== user.full_name ||
                draft.role !== user.role ||
                draft.is_active !== user.is_active
              )
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

  async function handleSave(user: UserRow) {
    const draft = drafts[user.id]
    if (!draft) return
    if (!draft.full_name.trim()) {
      setError('O nome do usuário não pode ficar vazio.')
      return
    }

    setSavingId(user.id)
    setSuccessId(null)
    setError(null)

    try {
      const { error: updateError } = await (supabase.from('profiles') as any)
        .update({
          full_name: draft.full_name.trim(),
          role: draft.role,
          is_active: draft.is_active,
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
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Criado em</th>
              <th className="px-5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {users.map(user => {
              const draft = drafts[user.id]
              const isSaving = savingId === user.id
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
                    <select
                      value={draft.role}
                      onChange={event =>
                        updateDraft(user.id, {
                          ...draft,
                          role: event.target.value as UserRole,
                        })
                      }
                      className="input h-10 min-w-[220px]"
                      disabled={isSaving}
                    >
                      {ROLE_OPTIONS.map(role => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={draft.is_active ? 'active' : 'inactive'}
                      onChange={event =>
                        updateDraft(user.id, {
                          ...draft,
                          is_active: event.target.value === 'active',
                        })
                      }
                      className="input h-10 min-w-[160px]"
                      disabled={isSaving}
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
                          draft.is_active
                            ? 'bg-green-50 text-green-700'
                            : 'bg-neutral-100 text-neutral-500'
                        }`}
                      >
                        {draft.is_active ? 'Ativo' : 'Inativo'}
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
