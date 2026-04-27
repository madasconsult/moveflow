import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldOff } from 'lucide-react'

export const metadata: Metadata = { title: 'Acesso Negado' }

const REASONS: Record<string, { title: string; description: string }> = {
  no_profile: {
    title: 'Perfil não encontrado',
    description:
      'Sua conta existe, mas o perfil de acesso não foi configurado. Entre em contato com o administrador FAUS.',
  },
  inactive: {
    title: 'Conta desativada',
    description:
      'Seu acesso foi desativado. Entre em contato com o administrador FAUS para reativação.',
  },
  forbidden: {
    title: 'Acesso não permitido',
    description:
      'Você não tem permissão para acessar esta página com o seu perfil atual.',
  },
}

export default function UnauthorizedPage({
  searchParams,
}: {
  searchParams: { reason?: string }
}) {
  const reason = REASONS[searchParams.reason ?? ''] ?? REASONS.forbidden

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
            <ShieldOff size={32} className="text-red-500" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-neutral-900">{reason.title}</h1>
          <p className="text-sm text-neutral-500 leading-relaxed">{reason.description}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login" className="btn-primary">
            Voltar ao login
          </Link>
        </div>

        <p className="text-xs text-neutral-400">
          MOVE FLOW — FAUS Soluções Estratégicas
        </p>
      </div>
    </div>
  )
}
