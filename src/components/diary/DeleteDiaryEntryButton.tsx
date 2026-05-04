'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface DeleteDiaryEntryButtonProps {
  entryId: string
  redirectTo?: string
}

export function DeleteDiaryEntryButton({
  entryId,
  redirectTo = '/dashboard/diario-de-bordo',
}: DeleteDiaryEntryButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  async function handleDelete() {
    setErrorMessage(null)
    setSuccessMessage(null)

    const confirmed = window.confirm(
      'Excluir este registro do Diário de Bordo? Ele sairá da lista e dos indicadores.'
    )

    if (!confirmed) return

    setDeleting(true)

    try {
      const entriesTable = supabase.from('diary_entries') as any
      const { error } = await entriesTable
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', entryId)

      if (error) throw new Error(error.message)

      setSuccessMessage('Registro excluído com sucesso.')
      router.refresh()
      router.push(redirectTo)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível excluir o registro.'
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-secondary border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
        onClick={handleDelete}
        disabled={deleting}
      >
        {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        {deleting ? 'Excluindo...' : 'Excluir'}
      </button>
      {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      {successMessage && <p className="text-xs text-green-700">{successMessage}</p>}
    </div>
  )
}
