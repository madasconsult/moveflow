'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/hooks/useAuthStore'
import type { Profile } from '@/types/database.types'

interface AuthProviderProps {
  profile: Profile
  children: React.ReactNode
}

// Recebe o profile já buscado no Server Component e hidrata o Zustand.
// Padrão seguro: a fonte de verdade é sempre o servidor (RLS), 
// o store é apenas um cache de leitura para Client Components.
export function AuthProvider({ profile, children }: AuthProviderProps) {
  const setProfile = useAuthStore(s => s.setProfile)
  const clear = useAuthStore(s => s.clear)

  useEffect(() => {
    setProfile(profile)

    return () => {
      clear()
    }
  }, [clear, profile, setProfile])

  return <>{children}</>
}
