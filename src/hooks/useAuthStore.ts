import { create } from 'zustand'
import type { Profile } from '@/types/database.types'

interface AuthState {
  profile: Profile | null
  isLoading: boolean
  setProfile: (profile: Profile | null) => void
  setLoading: (v: boolean) => void
  clear: () => void
}

// Store leve para manter o perfil disponível nos Client Components
// sem precisar prop-drill de Server Components.
// Alimentado pelo AuthProvider no layout.
export const useAuthStore = create<AuthState>(set => ({
  profile:   null,
  isLoading: true,
  setProfile: profile => set({ profile, isLoading: false }),
  setLoading: isLoading => set({ isLoading }),
  clear: () => set({ profile: null, isLoading: false }),
}))

// Seletores convenientes
export const useProfile  = () => useAuthStore(s => s.profile)
export const useIsAdmin  = () => useAuthStore(s => s.profile?.role === 'admin_faus')
export const useIsClient = () => useAuthStore(s => s.profile?.role === 'cliente')
