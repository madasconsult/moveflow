/**
 * AI Insights — geração via OpenAI
 *
 * Chama a API da OpenAI com o contexto sanitizado e retorna a resposta
 * estruturada como AiReportInsights.
 *
 * Segurança:
 *   - API key lida exclusivamente de process.env (nunca exposta em log)
 *   - Prompt completo com dados do cliente nunca é logado
 *   - Modelo validado contra lista segura; fallback para gpt-4o-mini
 */

import OpenAI from 'openai'
import type { AiReportInsights } from '@/lib/ai/types'
import { REPORT_INSIGHTS_SYSTEM_PROMPT } from '@/lib/ai/prompts'

// Modelos válidos conhecidos — evita uso acidental de modelos inexistentes.
const KNOWN_VALID_MODELS = new Set([
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4-turbo-preview',
  'gpt-4',
  'gpt-3.5-turbo',
  'o1',
  'o1-mini',
  'o3',
  'o3-mini',
])

const SAFE_FALLBACK_MODEL = 'gpt-4o-mini'

/** Resolve o modelo a usar, com fallback seguro para gpt-4o-mini. */
function resolveModel(): string {
  const configured = process.env.OPENAI_MODEL
  if (configured && KNOWN_VALID_MODELS.has(configured)) return configured
  return SAFE_FALLBACK_MODEL
}

/**
 * Erros que podem ser propagados ao caller com mensagem segura
 * (sem expor detalhes internos da API ou dados do cliente).
 */
export class AiInsightsError extends Error {
  constructor(
    message: string,
    public readonly code: 'api_error' | 'parse_error' | 'no_key' | 'timeout'
  ) {
    super(message)
    this.name = 'AiInsightsError'
  }
}

/**
 * Valida e extrai AiReportInsights de uma string JSON.
 * Retorna null se a estrutura for inválida.
 */
function parseInsights(raw: string): AiReportInsights | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null

  const obj = parsed as Record<string, unknown>

  const executive_summary = typeof obj.executive_summary === 'string' ? obj.executive_summary : ''
  const key_progress = Array.isArray(obj.key_progress) ? obj.key_progress.filter((s): s is string => typeof s === 'string') : []
  const attention_points = Array.isArray(obj.attention_points) ? obj.attention_points.filter((s): s is string => typeof s === 'string') : []
  const risks = Array.isArray(obj.risks) ? obj.risks.filter((s): s is string => typeof s === 'string') : []
  const recommended_actions = Array.isArray(obj.recommended_actions) ? obj.recommended_actions.filter((s): s is string => typeof s === 'string') : []
  const client_message = typeof obj.client_message === 'string' ? obj.client_message : ''
  const data_limitations = Array.isArray(obj.data_limitations) ? obj.data_limitations.filter((s): s is string => typeof s === 'string') : []

  // Exige pelo menos executive_summary para considerar a resposta válida
  if (!executive_summary) return null

  return {
    executive_summary,
    key_progress,
    attention_points,
    risks,
    recommended_actions,
    client_message,
    data_limitations,
  }
}

/**
 * Gera AI Insights para um relatório com base no contexto sanitizado.
 *
 * @param context - String de contexto construída por buildReportContext()
 * @param customQuestion - Pergunta opcional do usuário (já validada e sanitizada pela rota)
 * @returns AiReportInsights estruturado
 * @throws AiInsightsError em caso de falha na API ou parse
 */
export async function generateReportInsights(
  context: string,
  customQuestion?: string
): Promise<AiReportInsights> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new AiInsightsError('OPENAI_API_KEY não configurada.', 'no_key')
  }

  const client = new OpenAI({ apiKey })
  const model = resolveModel()

  // A pergunta é inserida após os dados do projeto com separador explícito,
  // tratada como dado de entrada — nunca como instrução de sistema.
  const userContent = customQuestion
    ? `${context}\n\n---\n[PERGUNTA DO USUÁRIO]\n${customQuestion}\n---\n\nCom base nos dados acima, responda à pergunta de forma direta, usando números e evidências do contexto. Se os dados não sustentarem a resposta, declare em data_limitations.`
    : context

  let rawContent: string | null
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: REPORT_INSIGHTS_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2048,
    })
    rawContent = completion.choices[0]?.message?.content ?? null
  } catch (error: unknown) {
    // Não loga o prompt — pode conter dados do cliente
    const isTimeout =
      error instanceof Error &&
      (error.message.includes('timeout') || error.message.includes('ETIMEDOUT'))
    if (isTimeout) {
      throw new AiInsightsError('Timeout na chamada à API de IA.', 'timeout')
    }
    throw new AiInsightsError('Falha na chamada à API de IA.', 'api_error')
  }

  if (!rawContent) {
    throw new AiInsightsError('A IA retornou resposta vazia.', 'parse_error')
  }

  const insights = parseInsights(rawContent)
  if (!insights) {
    throw new AiInsightsError('Não foi possível interpretar a resposta da IA.', 'parse_error')
  }

  return insights
}
