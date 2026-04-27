import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/ui/PlaceholderPage'

export const metadata: Metadata = { title: 'Indicadores' }

export default function Page() {
  return (
    <PlaceholderPage
      title="Indicadores"
      description="Acompanhe os indicadores do seu projeto. Módulo disponível em breve."
      backHref="/portal"
      backLabel="Voltar ao Projeto"
    />
  )
}
