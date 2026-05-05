'use client'

import { useMemo, useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import type { ActiveProjectOption } from '@/lib/active-project/server'
import type { ReportType } from '@/components/reports/pdf/types'

interface ReportCenterClientProps {
  activeProject: ActiveProjectOption
}

interface ReportCardConfig {
  type: ReportType
  title: string
  description: string
  included: string[]
}

const REPORT_CARDS: ReportCardConfig[] = [
  {
    type: 'executive',
    title: 'Relatório Executivo do Projeto',
    description: 'Síntese consultiva para leitura gerencial do andamento do projeto.',
    included: [
      'Resumo do projeto e período analisado',
      'Indicadores de ações concluídas, em andamento e atrasadas',
      'Principais ações concluídas, em andamento, atrasadas e próximos passos',
    ],
  },
  {
    type: 'weekly',
    title: 'Relatório Semanal',
    description: 'Recorte operacional do período, com execução, reuniões e pontos de atenção.',
    included: [
      'Ações concluídas, criadas e vencidas no período',
      'Reuniões realizadas no período',
      'Próximos passos e pontos de atenção',
    ],
  },
  {
    type: 'actions',
    title: 'Relatório de Ações',
    description: 'Visão detalhada da carteira de ações, prazos, status e responsáveis.',
    included: [
      'Total de ações e distribuição por status',
      'Ações vencidas e próximas do vencimento',
      'Tabela detalhada com responsável, status, prazo e conclusão',
    ],
  },
]

function getDefaultStartDate() {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  return date.toISOString().slice(0, 10)
}

function getDefaultEndDate() {
  return new Date().toISOString().slice(0, 10)
}

export function ReportCenterClient({ activeProject }: ReportCenterClientProps) {
  const [startDate, setStartDate] = useState(getDefaultStartDate)
  const [endDate, setEndDate] = useState(getDefaultEndDate)
  const [loadingType, setLoadingType] = useState<ReportType | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const periodInvalid = useMemo(() => startDate > endDate, [startDate, endDate])

  async function handleGenerate(reportType: ReportType) {
    setMessage(null)

    if (periodInvalid) {
      setMessage({ type: 'error', text: 'A data inicial não pode ser maior que a data final.' })
      return
    }

    setLoadingType(reportType)
    try {
      const params = new URLSearchParams({
        projectId: activeProject.id,
        startDate,
        endDate,
      })
      const response = await fetch(`/api/reports/${reportType}?${params.toString()}`)

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(errorPayload?.error ?? 'Não foi possível gerar o PDF.')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `move-report-${reportType}-${startDate}-${endDate}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setMessage({ type: 'success', text: 'PDF gerado com sucesso.' })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível gerar o PDF.',
      })
    } finally {
      setLoadingType(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="relative bg-neutral-950 px-6 py-6 text-white">
          <div className="absolute left-0 top-0 h-full w-1.5 bg-[#0AFAB9]" />
          <div className="absolute bottom-0 right-8 h-1.5 w-24 bg-[#DB6100]" />
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0AFAB9]">
            MOVE REPORT
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            Central de geração de PDFs executivos
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">
            Selecione o período e gere relatórios institucionais FAUS com dados reais do projeto ativo.
          </p>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
              Projeto selecionado
            </p>
            <h2 className="mt-2 text-lg font-semibold text-neutral-900">{activeProject.project_name}</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {activeProject.client_name ?? 'Cliente não informado'}
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2">
            <div>
              <label htmlFor="report-start-date" className="label">
                Data inicial
              </label>
              <input
                id="report-start-date"
                type="date"
                value={startDate}
                onChange={event => setStartDate(event.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="report-end-date" className="label">
                Data final
              </label>
              <input
                id="report-end-date"
                type="date"
                value={endDate}
                onChange={event => setEndDate(event.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`mx-5 mb-5 rounded-xl border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {REPORT_CARDS.map(report => (
          <article
            key={report.type}
            className="card group flex min-h-[340px] flex-col overflow-hidden border-neutral-200 p-0 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="h-1.5 bg-[linear-gradient(90deg,#0AFAB9_0%,#0AFAB9_70%,#DB6100_70%,#DB6100_100%)]" />
            <div className="flex flex-1 flex-col p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-950 text-[#0AFAB9]">
              <FileText size={20} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-neutral-900">{report.title}</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">{report.description}</p>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Conteúdo incluído
              </p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                {report.included.map(item => (
                  <li key={item} className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => handleGenerate(report.type)}
              className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
              disabled={loadingType !== null}
            >
              {loadingType === report.type ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {loadingType === report.type ? 'Gerando PDF...' : 'Gerar PDF'}
            </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
