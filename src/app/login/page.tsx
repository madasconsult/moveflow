import Image from 'next/image'
import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Entrar',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen grid bg-[#071427] lg:grid-cols-[1.12fr_0.88fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <Image
          src="/branding/move-background.png"
          alt=""
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,20,39,0.18),rgba(7,20,39,0.52))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(95,177,255,0.22),transparent_30%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#071427] via-[#071427]/40 to-transparent" />

        <div className="relative z-10 flex h-full flex-col justify-end p-14">
          <div className="max-w-lg space-y-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#7fc0ff]">
              Controle, execução e clareza
            </p>
            <h1 className="text-5xl font-semibold leading-[1.05]">
              Uma visão executiva para acompanhar cada etapa do projeto.
            </h1>
            <p className="max-w-md text-base leading-7 text-slate-200/88">
              Planejamento, acompanhamento e tomada de decisão em um ambiente corporativo único,
              com leitura rápida e foco na entrega de resultados.
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex items-center justify-center overflow-hidden px-6 py-10 sm:px-10 lg:px-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(77,167,255,0.18),transparent_26%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0b1d36_0%,#071427_100%)]" />

        <div className="relative z-10 w-full max-w-md">
          <div className="mb-8 flex justify-center lg:justify-start">
            <Image
              src="/branding/move-logo-color.png"
              alt="MOVE FLOW"
              width={260}
              height={112}
              priority
              className="h-20 w-[250px] object-contain"
            />
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-7 shadow-[0_32px_80px_rgba(3,9,20,0.45)] backdrop-blur-xl sm:p-8">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7fc0ff]">
                MOVE FLOW
              </p>
              <h2 className="text-3xl font-semibold text-white">
                Entrar na plataforma
              </h2>
              <p className="text-sm leading-6 text-slate-300">
                Acesse com suas credenciais e acompanhe clientes, projetos e entregas em um só fluxo.
              </p>
            </div>

            <div className="mt-8">
              <LoginForm />
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400 lg:text-left">
            © {new Date().getFullYear()} MOVE FLOW. Plataforma interna de acompanhamento.
          </p>
        </div>
      </div>
    </div>
  )
}
