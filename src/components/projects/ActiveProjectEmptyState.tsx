import { FolderKanban } from 'lucide-react'

interface ActiveProjectEmptyStateProps {
  title?: string
  description?: string
}

export function ActiveProjectEmptyState({
  title = 'Projeto ativo não selecionado',
  description = 'Selecione um projeto ativo para visualizar os dados deste módulo.',
}: ActiveProjectEmptyStateProps) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      <FolderKanban size={36} className="mb-4 text-neutral-300" />
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-neutral-500">{description}</p>
    </div>
  )
}
