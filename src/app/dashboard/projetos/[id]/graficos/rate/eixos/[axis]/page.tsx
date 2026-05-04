import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { RateAxisLineChart } from '@/components/diagnosis/RateAxisLineChart'
import { buildRateAxisCriterionSeries } from '@/lib/rate-faus'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import type { Project, ProjectDiagnosis, RateAssessment, RateAssessmentItem, RateAssessmentVersion } from '@/types/database.types'

export const metadata: Metadata = { title: 'Gráfico de Eixo do Rate' }

interface PageProps {
  params: { id: string; axis: string }
}

export default async function RateAxisDetailChartPage({ params }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const axisName = decodeURIComponent(params.axis)
  const supabase = await createClient()
  const { data: projectData } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single()

  const project = (projectData as Project | null) ?? null
  if (!project) notFound()

  const { data: diagnosisData } = await supabase
    .from('project_diagnoses')
    .select('*')
    .eq('project_id', project.id)
    .maybeSingle()

  const diagnosis = (diagnosisData as ProjectDiagnosis | null) ?? null
  const { data: assessmentData } = diagnosis
    ? await supabase
      .from('rate_assessments')
      .select('*')
      .eq('diagnosis_id', diagnosis.id)
      .maybeSingle()
    : { data: null }

  const assessment = (assessmentData as RateAssessment | null) ?? null
  const { data: versionsData } = assessment
    ? await supabase
      .from('rate_assessment_versions')
      .select('*')
      .eq('assessment_id', assessment.id)
      .order('version_number', { ascending: true })
    : { data: [] as RateAssessmentVersion[] | null }

  const versions = (versionsData as RateAssessmentVersion[] | null) ?? []
  const { data: itemsData } = versions.length > 0
    ? await supabase
      .from('rate_assessment_items')
      .select('*')
      .in('version_id', versions.map(version => version.id))
    : { data: [] as RateAssessmentItem[] | null }

  const items = (itemsData as RateAssessmentItem[] | null) ?? []
  const axisSeries = buildRateAxisCriterionSeries(versions, items)
  const selectedSeries = axisSeries.find(series => series.axis === axisName) ?? null

  if (versions.length > 0 && !selectedSeries) notFound()

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">{axisName}</h1>
          <p className="page-subtitle">
            Abertura do eixo por critério, comparando todas as versões disponíveis do Rate.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/projetos/${project.id}`} className="btn-secondary">
            <ArrowLeft size={16} />
            Voltar ao projeto
          </Link>
          <Link href={`/dashboard/projetos/${project.id}/graficos/rate/eixos`} className="btn-primary">
            <BarChart3 size={16} />
            Radar por Eixo
          </Link>
        </div>
      </div>

      {selectedSeries ? (
        <RateAxisLineChart series={selectedSeries} />
      ) : (
        <div className="card px-6 py-12 text-sm text-neutral-500">
          Nenhum Rate FAUS ativo para detalhar neste projeto.
        </div>
      )}
    </div>
  )
}
