import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { RateEvolutionChart } from '@/components/diagnosis/RateEvolutionChart'
import { RateGauge } from '@/components/diagnosis/RateGauge'
import { buildRateVersionSeries, formatRateScore } from '@/lib/rate-faus'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { formatDate } from '@/lib/utils'
import type { Project, ProjectDiagnosis, RateAssessment, RateAssessmentVersion } from '@/types/database.types'

export const metadata: Metadata = { title: 'Gráfico Rate Geral' }

interface PageProps {
  params: { id: string }
}

export default async function RateGeneralChartPage({ params }: PageProps) {
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
  const latestVersion = versions[versions.length - 1] ?? null
  const versionSeries = buildRateVersionSeries(versions)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Rate Geral</h1>
          <p className="page-subtitle">
            Evolução executiva do Rate Geral do projeto {project.project_name}.
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

      {latestVersion ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <RateGauge score={latestVersion.overall_score} />
            <div className="card p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Versão atual</p>
              <h2 className="mt-3 text-2xl font-semibold text-neutral-900">{latestVersion.version_name}</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-neutral-400">Versão</p>
                  <p className="mt-1 text-sm font-medium text-neutral-800">v{latestVersion.version_number}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Data</p>
                  <p className="mt-1 text-sm font-medium text-neutral-800">{formatDate(latestVersion.assessment_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Score geral</p>
                  <p className="mt-1 text-sm font-medium text-neutral-800">{formatRateScore(latestVersion.overall_score)} / 5,0</p>
                </div>
              </div>
              <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">
                {latestVersion.notes ?? 'Nenhuma observação registrada para a versão atual.'}
              </p>
            </div>
          </div>

          <RateEvolutionChart versions={versionSeries} />
        </>
      ) : (
        <div className="card px-6 py-12 text-sm text-neutral-500">
          Nenhum Rate FAUS ativo para detalhar neste projeto.
        </div>
      )}
    </div>
  )
}
