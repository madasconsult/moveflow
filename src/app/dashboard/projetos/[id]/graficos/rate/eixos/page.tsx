import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { RateAxisLineChart } from '@/components/diagnosis/RateAxisLineChart'
import { RateRadarChart } from '@/components/diagnosis/RateRadarChart'
import {
  buildRateAxisCriterionSeries,
  calculateRateAxisScores,
  getRateProfileTemplate,
  type RateAxisScore,
} from '@/lib/rate-faus'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import type { Project, ProjectDiagnosis, RateAssessment, RateAssessmentItem, RateAssessmentVersion } from '@/types/database.types'

export const metadata: Metadata = { title: 'Gráfico Radar por Eixo' }

interface PageProps {
  params: { id: string }
}

export default async function RateAxesChartPage({ params }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

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
  const latestVersion = versions[versions.length - 1] ?? null
  const orderedAxisNames = latestVersion ? getRateProfileTemplate(latestVersion.profile_type).map(axis => axis.axis) : []
  const latestItems = latestVersion ? items.filter(item => item.version_id === latestVersion.id) : []
  const latestScoresMap = new Map(calculateRateAxisScores(latestItems).map(axis => [axis.axis, axis]))
  const latestAxisScores: RateAxisScore[] = orderedAxisNames
    .map(axis => latestScoresMap.get(axis))
    .filter((axis): axis is RateAxisScore => Boolean(axis))
  const axisSeries = buildRateAxisCriterionSeries(versions, items)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Radar por Eixo</h1>
          <p className="page-subtitle">
            Leitura ampliada dos eixos do Rate FAUS do projeto {project.project_name}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/projetos/${project.id}`} className="btn-secondary">
            <ArrowLeft size={16} />
            Voltar ao projeto
          </Link>
          <Link href={`/dashboard/projetos/${project.id}/diagnostico/rate`} className="btn-primary">
            <BarChart3 size={16} />
            Abrir Rate completo
          </Link>
        </div>
      </div>

      {versions.length > 0 ? (
        <>
          <RateRadarChart axes={latestAxisScores} />
          <div className="grid gap-5 xl:grid-cols-2">
            {axisSeries.map(series => (
              <Link
                key={series.axis}
                href={`/dashboard/projetos/${project.id}/graficos/rate/eixos/${encodeURIComponent(series.axis)}`}
                className="block rounded-[28px] transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <RateAxisLineChart series={series} compact />
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="card px-6 py-12 text-sm text-neutral-500">
          Nenhum Rate FAUS ativo para detalhar neste projeto.
        </div>
      )}
    </div>
  )
}
