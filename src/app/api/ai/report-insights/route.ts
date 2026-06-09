/**
 * POST /api/ai/report-insights
 *
 * Gera insights consultivos para um relatório usando IA.
 *
 * Fase 1 — infraestrutura reversível:
 *   - A IA é apenas consultiva (não cria nem edita dados)
 *   - Protegida por feature flag ENABLE_AI_INSIGHTS
 *   - Restrita a admin_faus nesta fase
 *   - Dados pessoais nunca enviados à IA
 *
 * Camadas de proteção:
 *   1. Feature flag (503 se desabilitado)
 *   2. Autenticação via getSessionWithProfile()
 *   3. Role (admin_faus apenas)
 *   4. Acesso ao projeto via validateReportProjectAccess()
 *   5. Sanitização de dados antes do envio à IA
 */

import { NextResponse } from 'next/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import {
  loadReportData,
  normalizeReportPeriod,
  validateReportProjectAccess,
} from '@/lib/reports'
import { sanitizeConsultantComment } from '@/components/reports/pdf/utils'
import { buildReportContext } from '@/lib/ai/build-report-context'
import { generateReportInsights, AiInsightsError } from '@/lib/ai/generate-report-insights'
import { loadAiInsightsData } from '@/lib/ai/load-insights-data'

export const runtime = 'nodejs'

const CUSTOM_QUESTION_MAX_LENGTH = 500

interface RequestPayload {
  projectId?: unknown
  startDate?: unknown
  endDate?: unknown
  consultantComment?: unknown
  customQuestion?: unknown
}

export async function POST(request: Request) {
  // ── 1. Feature flag ───────────────────────────────────────────────────────
  if (process.env.ENABLE_AI_INSIGHTS !== 'true') {
    return NextResponse.json(
      { error: 'AI Insights não está habilitado neste ambiente.' },
      { status: 503 }
    )
  }

  // ── 2. Autenticação ───────────────────────────────────────────────────────
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 })
  }
  if (session.status === 'no_profile' || session.status === 'inactive') {
    return NextResponse.json({ error: 'Perfil sem acesso ao recurso.' }, { status: 403 })
  }

  // ── 3. Role — apenas admin_faus nesta fase ────────────────────────────────
  if (session.profile.role !== 'admin_faus') {
    return NextResponse.json(
      { error: 'AI Insights está disponível apenas para Admin FAUS nesta fase.' },
      { status: 403 }
    )
  }

  // ── 4. Payload ────────────────────────────────────────────────────────────
  const payload = (await request.json().catch(() => ({}))) as RequestPayload

  const projectId = typeof payload.projectId === 'string' ? payload.projectId : null
  if (!projectId) {
    return NextResponse.json({ error: 'Informe o projeto para gerar os insights.' }, { status: 400 })
  }

  // ── 5. Acesso ao projeto ──────────────────────────────────────────────────
  const accessibleProject = await validateReportProjectAccess(session.profile, projectId)
  if (!accessibleProject) {
    return NextResponse.json(
      { error: 'Projeto não encontrado ou sem permissão de acesso.' },
      { status: 403 }
    )
  }

  // ── 6. Período ───────────────────────────────────────────────────────────
  const normalizedPeriod = normalizeReportPeriod(
    typeof payload.startDate === 'string' ? payload.startDate : null,
    typeof payload.endDate === 'string' ? payload.endDate : null
  )

  // ── 7. Dados do relatório + contexto enriquecido (paralelo) ─────────────────
  const [data, insightsData] = await Promise.all([
    loadReportData(projectId, normalizedPeriod.startDate, normalizedPeriod.endDate),
    loadAiInsightsData(projectId, normalizedPeriod.startDate, normalizedPeriod.endDate),
  ])

  if (!data) {
    return NextResponse.json(
      { error: 'Não foi possível carregar os dados do projeto.' },
      { status: 500 }
    )
  }

  // ── 8. Sanitização e contexto ─────────────────────────────────────────────
  const consultantComment = sanitizeConsultantComment(payload.consultantComment)
  const context = buildReportContext(data, consultantComment, insightsData)

  // ── 8b. Pergunta específica do usuário ────────────────────────────────────
  const rawQuestion = typeof payload.customQuestion === 'string' ? payload.customQuestion.trim() : ''
  if (rawQuestion.length > CUSTOM_QUESTION_MAX_LENGTH) {
    return NextResponse.json(
      { error: 'A pergunta deve ter no máximo 500 caracteres.' },
      { status: 400 }
    )
  }
  const customQuestion = rawQuestion || undefined

  // ── 9. Geração de insights ────────────────────────────────────────────────
  try {
    const insights = await generateReportInsights(context, customQuestion)
    return NextResponse.json({
      insights,
      meta: {
        project_name: data.project.project_name,
        period: normalizedPeriod,
        generated_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof AiInsightsError) {
      // Erros conhecidos — mensagem segura sem dados internos
      if (error.code === 'no_key') {
        return NextResponse.json(
          { error: 'IA não configurada neste ambiente.' },
          { status: 503 }
        )
      }
      if (error.code === 'timeout') {
        return NextResponse.json(
          { error: 'Tempo limite excedido ao consultar a IA. Tente novamente.' },
          { status: 504 }
        )
      }
      return NextResponse.json(
        { error: 'Não foi possível gerar os insights no momento. Tente novamente.' },
        { status: 502 }
      )
    }
    // Erro inesperado — sem detalhes internos na resposta
    return NextResponse.json(
      { error: 'Erro interno ao processar os insights.' },
      { status: 500 }
    )
  }
}
