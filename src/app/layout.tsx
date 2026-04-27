import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: {
    default: 'MOVE FLOW',
    template: '%s | MOVE FLOW',
  },
  description: 'Sistema de Gerenciamento de Projetos de Consultoria — FAUS Soluções Estratégicas',
  robots: 'noindex, nofollow', // app interno, não indexar
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className={`${inter.variable} ${inter.className} h-full font-sans`}>
        {children}
      </body>
    </html>
  )
}
