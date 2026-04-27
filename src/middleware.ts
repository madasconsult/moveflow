import { type NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/middleware'
import type { Profile } from '@/types/database.types'

// Rotas que qualquer pessoa pode acessar sem estar autenticado
const PUBLIC_ROUTES = ['/login', '/unauthorized']

// Rotas exclusivas do portal do cliente
const PORTAL_ROUTES = ['/portal']

// Rotas do painel interno (admin + consultor)
const DASHBOARD_ROUTES = ['/dashboard']

// Rotas exclusivas de admin
const ADMIN_ONLY_ROUTES = ['/dashboard/usuarios', '/dashboard/clientes']

type MiddlewareProfile = Pick<Profile, 'role' | 'is_active'>

async function getRequestProfile(
  supabase: ReturnType<typeof createMiddlewareClient>['supabase'],
  userId: string
) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', userId)
    .single()

  return { profile: (profile as MiddlewareProfile | null) ?? null, error }
}

function buildUnauthorizedUrl(request: NextRequest, reason: 'no_profile' | 'inactive' | 'forbidden') {
  const errorUrl = new URL('/unauthorized', request.url)
  errorUrl.searchParams.set('reason', reason)
  return errorUrl
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { supabase, supabaseResponse } = createMiddlewareClient(request)

  // ── 1. Refresh da sessão ─────────────────────────────────────────────────
  // CRÍTICO: getUser() com validação server-side, não apenas getSession()
  // getSession() lê apenas o cookie local e pode estar desatualizado
  const { data: { user } } = await supabase.auth.getUser()

  const isPublicRoute    = PUBLIC_ROUTES.some(r => pathname.startsWith(r))
  const isPortalRoute    = PORTAL_ROUTES.some(r => pathname.startsWith(r))
  const isDashboardRoute = DASHBOARD_ROUTES.some(r => pathname.startsWith(r))

  // ── 2. Rota pública ──────────────────────────────────────────────────────
  // Se usuário autenticado tenta acessar /login, redireciona para home correta
  if (isPublicRoute) {
    if (user && pathname.startsWith('/login')) {
      return redirectToHome(request, supabase)
    }
    return supabaseResponse
  }

  // ── 3. Não autenticado ───────────────────────────────────────────────────
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── 4. Busca o role do usuário ───────────────────────────────────────────
  const { profile } = await getRequestProfile(supabase, user.id)

  // Usuário autenticado mas sem perfil — estado de erro controlado
  if (!profile) {
    return NextResponse.redirect(buildUnauthorizedUrl(request, 'no_profile'))
  }

  // Usuário desativado
  if (!profile.is_active) {
    return NextResponse.redirect(buildUnauthorizedUrl(request, 'inactive'))
  }

  const role = profile.role

  // ── 5. Proteção de rotas por perfil ─────────────────────────────────────

  // Cliente tentando acessar o painel interno → redireciona para portal
  if (isDashboardRoute && role === 'cliente') {
    return NextResponse.redirect(new URL('/portal', request.url))
  }

  // Admin/consultor tentando acessar o portal do cliente → redireciona para dashboard
  if (isPortalRoute && (role === 'admin_faus' || role === 'consultor_faus')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ── 6. Proteção de rotas exclusivas de admin ─────────────────────────────
  const isAdminOnlyRoute = ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r))

  if (isAdminOnlyRoute && role !== 'admin_faus') {
    return NextResponse.redirect(buildUnauthorizedUrl(request, 'forbidden'))
  }

  // ── 7. Rota raiz ─────────────────────────────────────────────────────────
  if (pathname === '/') {
    const home = role === 'cliente' ? '/portal' : '/dashboard'
    return NextResponse.redirect(new URL(home, request.url))
  }

  return supabaseResponse
}

// Helper: redireciona usuário autenticado para a home correta
async function redirectToHome(request: NextRequest, supabase: ReturnType<typeof createMiddlewareClient>['supabase']) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { profile } = await getRequestProfile(supabase, user.id)

  if (!profile) {
    return NextResponse.redirect(buildUnauthorizedUrl(request, 'no_profile'))
  }

  if (!profile.is_active) {
    return NextResponse.redirect(buildUnauthorizedUrl(request, 'inactive'))
  }

  const home = profile?.role === 'cliente' ? '/portal' : '/dashboard'
  return NextResponse.redirect(new URL(home, request.url))
}

// Matcher: aplicar middleware em todas as rotas exceto assets estáticos
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
