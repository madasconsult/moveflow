const envSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const envSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!envSupabaseUrl) {
  throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL')
}

if (!envSupabaseAnonKey) {
  throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

const supabaseUrl: string = envSupabaseUrl
const supabaseAnonKey: string = envSupabaseAnonKey

export { supabaseUrl, supabaseAnonKey }
