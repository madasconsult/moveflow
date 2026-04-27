import Link from 'next/link'
import { Construction, ArrowLeft } from 'lucide-react'

interface PlaceholderPageProps {
  title:       string
  description: string
  backHref:    string
  backLabel?:  string
}

export function PlaceholderPage({
  title,
  description,
  backHref,
  backLabel = 'Voltar',
}: PlaceholderPageProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="card p-12 text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center">
            <Construction size={26} className="text-neutral-400" />
          </div>
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
          <p className="text-sm text-neutral-500">{description}</p>
        </div>
        <div className="pt-2">
          <Link href={backHref} className="btn-secondary inline-flex">
            <ArrowLeft size={15} />
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
