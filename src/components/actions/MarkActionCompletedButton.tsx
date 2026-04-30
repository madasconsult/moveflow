'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface MarkActionCompletedButtonProps {
  actionId: string
  isCompleted: boolean
  containerClassName?: string
  buttonClassName?: string
}

export function MarkActionCompletedButton({
  actionId,
  isCompleted,
  containerClassName,
  buttonClassName,
}: MarkActionCompletedButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleMarkCompleted() {
    if (isCompleted) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await (supabase.from('actions') as any)
        .update({
          status: 'completed',
          completion_date: new Date().toISOString(),
        })
        .eq('id', actionId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      setSuccess('Ação marcada como concluída.')
      router.refresh()
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Não foi possível concluir a ação.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn('space-y-3', containerClassName)}>
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleMarkCompleted}
        disabled={saving || isCompleted}
        className={cn('btn-primary w-full justify-center disabled:opacity-60', buttonClassName)}
      >
        {saving ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Marcando como concluída...
          </>
        ) : (
          <>
            <CheckCircle2 size={16} />
            {isCompleted ? 'Ação já concluída' : 'Marcar como concluída'}
          </>
        )}
      </button>
    </div>
  )
}
