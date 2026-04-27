import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/ui/PlaceholderPage'

export const metadata: Metadata = { title: 'Timeline' }

export default function Page() {
  return (
    <PlaceholderPage
      title="Timeline"
      description="Acompanhe o histórico cronológico dos projetos. Módulo disponível na Fase 2."
      backHref="/dashboard"
      backLabel="Voltar ao Dashboard"
    />
  )
}
