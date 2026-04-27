import { createClient } from '@/lib/supabase/server'
import type { Profile, UserRole } from '@/types/database.types'

type AuthProfile = Pick<Profile, 'id' | 'full_name' | 'email' | 'role' | 'avatar_url' | 'client_id' | 'is_active' | 'created_at' | 'updated_at'>

// Resultado padronizado de busca de sessão
export type SessionResult =
  | { status: 'authenticated'; user: { id: string; email: string }; profile: Profile }
  | { status: 'unauthenticated' }
  | { status: 'no_profile'; user: { id: string; email: string } }
  | { status: 'inactive'; user: { id: string; email: string }; profile: Profile }

// Busca sessão + perfil do usuário em Server Components/Actions
// Única função de acesso a dados de auth no servidor
export async function getSessionWithProfile(): Promise<SessionResult> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { status: 'unauthenticated' }
  }

  const { data, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = (data as AuthProfile | null) ?? null

  if (profileError || !profile) {
    // Usuário existe no auth mas não tem perfil — estado de erro controlado
    return {
      status: 'no_profile',
      user: { id: user.id, email: user.email ?? '' },
    }
  }

  if (!profile.is_active) {
    return {
      status: 'inactive',
      user: { id: user.id, email: user.email ?? '' },
      profile,
    }
  }

  return {
    status: 'authenticated',
    user: { id: user.id, email: user.email ?? '' },
    profile,
  }
}

// Retorna apenas o perfil autenticado ou null
// Uso: Server Components que já sabem que o usuário está autenticado
export async function getAuthenticatedProfile(): Promise<Profile | null> {
  const result = await getSessionWithProfile()
  if (result.status === 'authenticated') return result.profile
  return null
}

// Verifica se o usuário tem um dos roles permitidos
export function hasRole(profile: Profile, roles: UserRole[]): boolean {
  return roles.includes(profile.role)
}

export function isAdmin(profile: Profile): boolean {
  return profile.role === 'admin_faus'
}

export function isConsultor(profile: Profile): boolean {
  return profile.role === 'consultor_faus'
}

export function isCliente(profile: Profile): boolean {
  return profile.role === 'cliente'
}

// Rota inicial por role após login
export function getHomeRouteForRole(role: UserRole): string {
  switch (role) {
    case 'admin_faus':
    case 'consultor_faus':
      return '/dashboard'
    case 'cliente':
      return '/portal'
  }
}
