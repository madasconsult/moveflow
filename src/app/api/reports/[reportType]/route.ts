import React from 'react'
import { NextResponse } from 'next/server'
import { pdf } from '@react-pdf/renderer'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import {
  canAccessReports,
  isReportType,
  loadReportData,
  normalizeReportPeriod,
  validateReportProjectAccess,
} from '@/lib/reports'
import { loadReportAssets } from '@/lib/reports/assets'
import { ExecutiveProjectReport } from '@/components/reports/pdf/ExecutiveProjectReport'
import { WeeklyProjectReport } from '@/components/reports/pdf/WeeklyProjectReport'
import { ActionsReport } from '@/components/reports/pdf/ActionsReport'
import { sanitizeConsultantComment } from '@/components/reports/pdf/utils'
import type { ReportData, ReportType } from '@/components/reports/pdf/types'

export const runtime = 'nodejs'

interface RouteContext {
  params: {
    reportType: string
  }
}

export async function GET(request: Request, context: RouteContext) {
  const url = new URL(request.url)

  return generateReportResponse({
    reportTypeParam: context.params.reportType,
    projectId: url.searchParams.get('projectId'),
    startDate: url.searchParams.get('startDate'),
    endDate: url.searchParams.get('endDate'),
    consultantComment: url.searchParams.get('consultantComment'),
  })
}

export async function POST(request: Request, context: RouteContext) {
  const payload = await request.json().catch(() => ({}))

  return generateReportResponse({
    reportTypeParam: context.params.reportType,
    projectId: typeof payload.projectId === 'string' ? payload.projectId : null,
    startDate: typeof payload.startDate === 'string' ? payload.startDate : null,
    endDate: typeof payload.endDate === 'string' ? payload.endDate : null,
    consultantComment: payload.consultantComment,
  })
}

async function generateReportResponse({
  reportTypeParam,
  projectId,
  startDate,
  endDate,
  consultantComment,
}: {
  reportTypeParam: string
  projectId: string | null
  startDate: string | null
  endDate: string | null
  consultantComment?: unknown
}) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 })
  }
  if (session.status === 'no_profile' || session.status === 'inactive') {
    return NextResponse.json({ error: 'Perfil sem acesso ao relatório.' }, { status: 403 })
  }
  if (!canAccessReports(session.profile)) {
    return NextResponse.json({ error: 'Acesso não permitido para este perfil.' }, { status: 403 })
  }

  const reportType = reportTypeParam
  if (!isReportType(reportType)) {
    return NextResponse.json({ error: 'Tipo de relatório inválido.' }, { status: 400 })
  }

  const normalizedPeriod = normalizeReportPeriod(
    startDate,
    endDate
  )

  if (!projectId) {
    return NextResponse.json({ error: 'Informe o projeto para gerar o relatório.' }, { status: 400 })
  }

  const accessibleProject = await validateReportProjectAccess(session.profile, projectId)
  if (!accessibleProject) {
    return NextResponse.json({ error: 'Projeto não encontrado ou sem permissão de acesso.' }, { status: 403 })
  }

  const data = await loadReportData(projectId, normalizedPeriod.startDate, normalizedPeriod.endDate)
  if (!data) {
    return NextResponse.json({ error: 'Não foi possível carregar os dados do projeto.' }, { status: 500 })
  }

  const reportData = {
    ...data,
    assets: loadReportAssets(),
    consultantComment: sanitizeConsultantComment(consultantComment),
  }
  const reportDocument = getReportDocument(reportType, reportData) as Parameters<typeof pdf>[0]
  const pdfBuffer = await pdf(reportDocument).toBuffer()
  const fileName = `move-report-${reportType}-${normalizedPeriod.startDate}-${normalizedPeriod.endDate}.pdf`

  return new Response(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}

function getReportDocument(reportType: ReportType, data: ReportData) {
  if (reportType === 'weekly') {
    return React.createElement(WeeklyProjectReport, { data })
  }
  if (reportType === 'actions') {
    return React.createElement(ActionsReport, { data })
  }
  return React.createElement(ExecutiveProjectReport, { data })
}
