import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/config'

// Cliente para uso em Client Components ('use client')
// Instância singleton por tab — não recria a cada render
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}
