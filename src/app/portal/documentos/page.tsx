import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/ui/PlaceholderPage'

export const metadata: Metadata = { title: 'Documentos' }

export default function Page() {
  return (
    <PlaceholderPage
      title="Documentos"
      description="Acesse os documentos do seu projeto. Módulo disponível em breve."
      backHref="/portal"
      backLabel="Voltar ao Projeto"
    />
  )
}
