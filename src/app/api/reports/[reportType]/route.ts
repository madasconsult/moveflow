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
import type { ReportData, ReportType } from '@/components/reports/pdf/types'

export const runtime = 'nodejs'

interface RouteContext {
  params: {
    reportType: string
  }
}

export async function GET(request: Request, context: RouteContext) {
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

  const reportType = context.params.reportType
  if (!isReportType(reportType)) {
    return NextResponse.json({ error: 'Tipo de relatório inválido.' }, { status: 400 })
  }

  const url = new URL(request.url)
  const projectId = url.searchParams.get('projectId')
  const { startDate, endDate } = normalizeReportPeriod(
    url.searchParams.get('startDate'),
    url.searchParams.get('endDate')
  )

  if (!projectId) {
    return NextResponse.json({ error: 'Informe o projeto para gerar o relatório.' }, { status: 400 })
  }

  const accessibleProject = await validateReportProjectAccess(session.profile, projectId)
  if (!accessibleProject) {
    return NextResponse.json({ error: 'Projeto não encontrado ou sem permissão de acesso.' }, { status: 403 })
  }

  const data = await loadReportData(projectId, startDate, endDate)
  if (!data) {
    return NextResponse.json({ error: 'Não foi possível carregar os dados do projeto.' }, { status: 404 })
  }

  const reportData = {
    ...data,
    assets: loadReportAssets(),
  }
  const reportDocument = getReportDocument(reportType, reportData) as Parameters<typeof pdf>[0]
  const pdfBuffer = await pdf(reportDocument).toBuffer()
  const fileName = `move-report-${reportType}-${startDate}-${endDate}.pdf`

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
