/**
 * AI Insights — tipos compartilhados
 *
 * Nesta fase a IA é apenas consultiva: lê dados, analisa, sugere.
 * Não cria nem altera nenhum dado.
 */

/** Resposta estruturada gerada pela IA para o contexto de um relatório. */
export interface AiReportInsights {
  /** Resumo executivo do projeto no período analisado. */
  executive_summary: string

  /** Principais avanços identificados nos dados. */
  key_progress: string[]

  /** Pontos de atenção que merecem monitoramento. */
  attention_points: string[]

  /** Riscos identificados nos dados fornecidos. */
  risks: string[]

  /** Ações recomendadas pela análise consultiva. */
  recommended_actions: string[]

  /** Texto consultivo para comunicação ao cliente (tom executivo). */
  client_message: string

  /**
   * Limitações dos dados que afetaram a análise.
   * Preenchido quando há ausência de KPIs, reuniões, ações ou outros
   * indicadores que impediriam conclusões confiáveis.
   */
  data_limitations: string[]
}

/** Payload aceito pelo endpoint POST /api/ai/report-insights */
export interface AiReportInsightsRequest {
  projectId: string
  startDate: string
  endDate: string
  /** Comentário consultivo opcional do consultor (sanitizado antes do envio). */
  consultantComment?: string | null
}
