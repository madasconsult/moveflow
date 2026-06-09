'use client'

import { useMemo, useState } from 'react'
import { Clipboard, Download, FileDown, FileText, Loader2, Sparkles } from 'lucide-react'
import type { ActiveProjectOption } from '@/lib/active-project/server'
import type { ReportType } from '@/components/reports/pdf/types'
import type { AiReportInsights } from '@/lib/ai/types'
import { CONSULTANT_COMMENT_MAX_LENGTH } from '@/components/reports/pdf/utils'

interface ReportCenterClientProps {
  activeProject: ActiveProjectOption
  canUseAiBriefing: boolean
  canUseAiInsights: boolean
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

export function ReportCenterClient({ activeProject, canUseAiBriefing, canUseAiInsights }: ReportCenterClientProps) {
  const [startDate, setStartDate] = useState(getDefaultStartDate)
  const [endDate, setEndDate] = useState(getDefaultEndDate)
  const [consultantComment, setConsultantComment] = useState('')
  const [loadingType, setLoadingType] = useState<ReportType | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingText, setBriefingText] = useState('')
  const [briefingMessage, setBriefingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insights, setInsights] = useState<AiReportInsights | null>(null)
  const [insightsMessage, setInsightsMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  const periodInvalid = useMemo(() => startDate > endDate, [startDate, endDate])

  async function handleGenerate(reportType: ReportType) {
    setMessage(null)

    if (periodInvalid) {
      setMessage({ type: 'error', text: 'A data inicial não pode ser maior que a data final.' })
      return
    }

    setLoadingType(reportType)
    try {
      const response = await fetch(`/api/reports/${reportType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: activeProject.id,
          startDate,
          endDate,
          consultantComment,
        }),
      })

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

  async function handleGenerateBriefing() {
    setMessage(null)
    setBriefingMessage(null)

    if (periodInvalid) {
      setBriefingMessage({ type: 'error', text: 'A data inicial não pode ser maior que a data final.' })
      return
    }

    setBriefingLoading(true)
    try {
      const response = await fetch('/api/reports/ai-briefing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: activeProject.id,
          startDate,
          endDate,
          consultantComment,
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Não foi possível gerar o briefing.')
      }
      if (typeof payload?.briefing !== 'string' || !payload.briefing.trim()) {
        throw new Error('O briefing retornado está vazio.')
      }

      setBriefingText(payload.briefing)
      setBriefingMessage({ type: 'success', text: 'Briefing gerado com sucesso.' })
    } catch (error) {
      setBriefingMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível gerar o briefing.',
      })
    } finally {
      setBriefingLoading(false)
    }
  }

  async function handleCopyBriefing() {
    if (!briefingText) {
      setBriefingMessage({ type: 'error', text: 'Gere o briefing antes de copiar.' })
      return
    }

    try {
      await navigator.clipboard.writeText(briefingText)
      setBriefingMessage({ type: 'success', text: 'Briefing copiado para a área de transferência.' })
    } catch {
      setBriefingMessage({
        type: 'error',
        text: 'Não foi possível copiar automaticamente. Selecione o texto do briefing e copie manualmente.',
      })
    }
  }

  async function handleGenerateInsights() {
    setInsightsMessage(null)
    setInsights(null)

    if (periodInvalid) {
      setInsightsMessage({ type: 'error', text: 'A data inicial não pode ser maior que a data final.' })
      return
    }

    setInsightsLoading(true)
    try {
      const response = await fetch('/api/ai/report-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject.id,
          startDate,
          endDate,
          consultantComment: consultantComment || null,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (response.status === 503) {
        setInsightsMessage({
          type: 'info',
          text: payload?.error ?? 'AI Insights não está habilitado neste ambiente.',
        })
        return
      }

      if (response.status === 403) {
        setInsightsMessage({
          type: 'error',
          text: 'Sem permissão para gerar análise com IA.',
        })
        return
      }

      if (!response.ok) {
        setInsightsMessage({
          type: 'error',
          text: payload?.error ?? 'Não foi possível gerar a análise. Tente novamente.',
        })
        return
      }

      if (!payload?.insights) {
        setInsightsMessage({ type: 'error', text: 'A análise retornada está incompleta. Tente novamente.' })
        return
      }

      setInsights(payload.insights)
      setInsightsMessage({ type: 'success', text: 'Análise gerada com sucesso.' })
    } catch {
      setInsightsMessage({
        type: 'error',
        text: 'Não foi possível conectar ao serviço de IA. Verifique sua conexão e tente novamente.',
      })
    } finally {
      setInsightsLoading(false)
    }
  }

  function handleDownloadBriefing() {
    if (!briefingText) {
      setBriefingMessage({ type: 'error', text: 'Gere o briefing antes de baixar.' })
      return
    }

    const blob = new Blob([briefingText], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `briefing-ia-move-report-${startDate}-${endDate}.md`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setBriefingMessage({ type: 'success', text: 'Arquivo .md do briefing gerado.' })
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

        <div className="border-t border-neutral-100 px-5 pb-5">
          <label htmlFor="consultant-comment" className="label">
            Comentário Consultivo
          </label>
          <textarea
            id="consultant-comment"
            value={consultantComment}
            onChange={event => setConsultantComment(event.target.value.slice(0, CONSULTANT_COMMENT_MAX_LENGTH))}
            maxLength={CONSULTANT_COMMENT_MAX_LENGTH}
            className="input min-h-32 resize-y"
            placeholder="Inclua uma leitura consultiva sobre o período, acontecimentos relevantes, decisões, riscos ou próximos passos."
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
            <p>
              Campo opcional. O texto preenchido será incluído nos PDFs gerados.
            </p>
            <p>
              {consultantComment.length}/{CONSULTANT_COMMENT_MAX_LENGTH} caracteres
            </p>
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

      {canUseAiInsights && (
        <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="grid gap-5 border-b border-neutral-100 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0AFAB9]">
                Admin FAUS — Fase I
              </p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-900">Análise com IA</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
                Gere uma análise consultiva do período com base nos dados do projeto. A IA identifica avanços, riscos, pontos de atenção e recomendações. Apenas o conteúdo do projeto é enviado — sem dados pessoais.
              </p>
              <p className="mt-2 text-xs font-medium text-neutral-400">
                Geração manual. Nenhuma análise é criada automaticamente ao abrir o relatório.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateInsights}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
              disabled={insightsLoading || loadingType !== null}
            >
              {insightsLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {insightsLoading ? 'Gerando análise...' : 'Gerar análise com IA'}
            </button>
          </div>

          {insightsMessage && (
            <div
              className={`mx-5 mt-5 rounded-xl border px-4 py-3 text-sm ${
                insightsMessage.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : insightsMessage.type === 'info'
                    ? 'border-neutral-200 bg-neutral-50 text-neutral-600'
                    : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {insightsMessage.text}
            </div>
          )}

          {insights && (
            <div className="space-y-5 p-5">
              {insights.executive_summary && (
                <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
                    Resumo executivo
                  </p>
                  <p className="mt-2 text-sm leading-6 text-neutral-800">{insights.executive_summary}</p>
                </div>
              )}

              {insights.key_progress.length > 0 && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                    Avanços identificados
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {insights.key_progress.map((item, index) => (
                      <li key={index} className="flex gap-2 text-sm leading-6 text-emerald-800">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insights.attention_points.length > 0 && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
                    Pontos de atenção
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {insights.attention_points.map((item, index) => (
                      <li key={index} className="flex gap-2 text-sm leading-6 text-amber-800">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insights.risks.length > 0 && (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">
                    Riscos identificados
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {insights.risks.map((item, index) => (
                      <li key={index} className="flex gap-2 text-sm leading-6 text-red-800">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insights.recommended_actions.length > 0 && (
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    Ações recomendadas
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {insights.recommended_actions.map((item, index) => (
                      <li key={index} className="flex gap-2 text-sm leading-6 text-neutral-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insights.client_message && (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-950 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0AFAB9]">
                    Mensagem consultiva ao cliente
                  </p>
                  <p className="mt-2 text-sm leading-6 text-neutral-300">{insights.client_message}</p>
                </div>
              )}

              {insights.data_limitations.length > 0 && (
                <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
                    Limitações dos dados
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {insights.data_limitations.map((item, index) => (
                      <li key={index} className="flex gap-2 text-sm leading-6 text-neutral-500">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {canUseAiBriefing && (
        <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="grid gap-5 border-b border-neutral-100 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#DB6100]">
                Apoio externo controlado
              </p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-900">Briefing para IA</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
                Gere um pacote estruturado com dados do projeto, contexto do período, regras de análise e diretrizes visuais da FAUS para copiar e usar no ChatGPT ou Claude.
              </p>
              <p className="mt-2 text-xs font-medium text-neutral-500">
                Esta função não chama API externa, não gera custo e não salva nada no banco.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerateBriefing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
                disabled={briefingLoading || loadingType !== null}
              >
                {briefingLoading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                {briefingLoading ? 'Gerando briefing...' : 'Gerar briefing'}
              </button>
              <button
                type="button"
                onClick={handleCopyBriefing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!briefingText || briefingLoading}
              >
                <Clipboard size={16} />
                Copiar briefing
              </button>
              <button
                type="button"
                onClick={handleDownloadBriefing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!briefingText || briefingLoading}
              >
                <FileDown size={16} />
                Baixar .md
              </button>
            </div>
          </div>

          {briefingMessage && (
            <div
              className={`mx-5 mt-5 rounded-xl border px-4 py-3 text-sm ${
                briefingMessage.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {briefingMessage.text}
            </div>
          )}

          <div className="p-5">
            <label htmlFor="ai-briefing-output" className="label">
              Briefing gerado
            </label>
            <textarea
              id="ai-briefing-output"
              value={briefingText}
              onChange={event => setBriefingText(event.target.value)}
              className="input min-h-[420px] resize-y font-mono text-xs leading-5"
              placeholder="Clique em “Gerar briefing” para montar um pacote em Markdown com dados reais do projeto e instruções para uso externo em IA."
            />
          </div>
        </section>
      )}
    </div>
  )
}
