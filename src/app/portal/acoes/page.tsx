import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/ui/PlaceholderPage'

export const metadata: Metadata = { title: 'Ações' }

export default function Page() {
  return (
    <PlaceholderPage
      title="Ações"
      description="Acompanhe as ações do seu projeto. Módulo disponível em breve."
      backHref="/portal"
      backLabel="Voltar ao Projeto"
    />
  )
}
