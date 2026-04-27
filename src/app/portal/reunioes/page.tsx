import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/ui/PlaceholderPage'

export const metadata: Metadata = { title: 'Reuniões' }

export default function Page() {
  return (
    <PlaceholderPage
      title="Reuniões"
      description="Acompanhe as reuniões do seu projeto. Módulo disponível em breve."
      backHref="/portal"
      backLabel="Voltar ao Projeto"
    />
  )
}
