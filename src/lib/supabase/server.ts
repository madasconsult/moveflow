import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/config'

// Cliente para uso em Server Components, Server Actions e Route Handlers
// Lê e escreve cookies via next/headers
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieOptionsWithName[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll pode ser chamado de Server Component (read-only).
            // Cookies de sessão serão tratados pelo middleware.
          }
        },
      },
    }
  )
}
