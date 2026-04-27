'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Profile, UserRole } from '@/types/database.types'

type LoginProfile = Pick<Profile, 'role' | 'is_active'>

function getHomeRouteForRole(role: UserRole) {
  return role === 'cliente' ? '/portal' : '/dashboard'
}

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (authError) {
      setLoading(false)
      // Mensagens de erro amigáveis em pt-BR
      if (authError.message.includes('Invalid login credentials')) {
        setError('E-mail ou senha incorretos. Verifique suas credenciais.')
      } else if (authError.message.includes('Email not confirmed')) {
        setError('E-mail não confirmado. Entre em contato com o administrador.')
      } else {
        setError('Não foi possível fazer login. Tente novamente.')
      }
      return
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      await supabase.auth.signOut()
      setLoading(false)
      setError('Não foi possível identificar o usuário autenticado. Faça login novamente.')
      return
    }

    // Busca o profile do usuário autenticado explicitamente pelo id
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    const profile = (data as LoginProfile | null) ?? null

    if (profileError || !profile) {
      await supabase.auth.signOut()
      setLoading(false)
      setError('Perfil de usuário não encontrado. Entre em contato com o administrador.')
      return
    }

    if (!profile.is_active) {
      await supabase.auth.signOut()
      setLoading(false)
      setError('Sua conta está desativada. Entre em contato com o administrador.')
      return
    }

    // Redireciona por perfil
    const destination = getHomeRouteForRole(profile.role)
    router.replace(destination)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Campo e-mail */}
      <div>
        <label htmlFor="email" className="label text-slate-100">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="seu@email.com.br"
          className="input"
          disabled={loading}
        />
      </div>

      {/* Campo senha */}
      <div>
        <label htmlFor="password" className="label text-slate-100">
          Senha
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPass ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className={cn('input pr-10 bg-white/95')}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowPass(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors"
            tabIndex={-1}
            aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Mensagem de erro */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100"
        >
          <span className="mt-0.5 shrink-0">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Botão submit */}
      <button
        type="submit"
        disabled={loading || !email || !password}
        className="btn-primary h-12 w-full rounded-xl text-base"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Entrando…
          </>
        ) : (
          'Entrar'
        )}
      </button>

      <p className="text-center text-xs text-slate-400">
        Problemas de acesso? Fale com o administrador FAUS.
      </p>
    </form>
  )
}
