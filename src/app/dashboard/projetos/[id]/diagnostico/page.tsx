import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { DiagnosisWorkspace } from '@/components/diagnosis/DiagnosisWorkspace'
import type {
  DiagnosisIndicator,
  Profile,
  Project,
  ProjectDiagnosis,
  RateAssessment,
  RateAssessmentItem,
  RateAssessmentVersion,
} from '@/types/database.types'

export const metadata: Metadata = { title: 'Diagnóstico do Projeto' }

interface PageProps {
  params: { id: string }
}

type ProjectLookup = Pick<Project, 'id' | 'project_name'>
type ResponsibleOption = Pick<Profile, 'id' | 'full_name'>

export default async function ProjectDiagnosisPage({ params }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const supabase = await createClient()

  const { data: projectData } = await supabase
    .from('projects')
    .select('id, project_name')
    .eq('id', params.id)
    .single()

  const project = (projectData as ProjectLookup | null) ?? null

  if (!project) notFound()

  const isAdmin = session.profile.role === 'admin_faus'

  const { data: diagnosisData } = await supabase
    .from('project_diagnoses')
    .select('*')
    .eq('project_id', project.id)
    .maybeSingle()

  const diagnosis = (diagnosisData as ProjectDiagnosis | null) ?? null

  const rateAssessmentRes = diagnosis
    ? await supabase
        .from('rate_assessments')
        .select('*')
        .eq('diagnosis_id', diagnosis.id)
        .maybeSingle()
    : { data: null, error: null }

  const rateFeatureEnabled = !rateAssessmentRes.error
  const rateAssessment = (rateAssessmentRes.data as RateAssessment | null) ?? null

  const rateVersionsRes =
    rateFeatureEnabled && rateAssessment
      ? await supabase
          .from('rate_assessment_versions')
          .select('*')
          .eq('assessment_id', rateAssessment.id)
          .order('version_number', { ascending: false })
      : { data: [] as RateAssessmentVersion[] | null }

  const [indicatorsRes, responsiblesRes] = await Promise.all([
    diagnosis
      ? supabase
          .from('diagnosis_indicators')
          .select('*')
          .eq('diagnosis_id', diagnosis.id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as DiagnosisIndicator[] | null }),
    isAdmin
      ? supabase
          .from('profiles')
          .select('id, full_name')
          .in('role', ['admin_faus', 'consultor_faus'])
          .eq('is_active', true)
          .order('full_name')
      : supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', session.profile.id),
  ])

  const indicators = (indicatorsRes.data as DiagnosisIndicator[] | null) ?? []
  const responsibles = (responsiblesRes.data as ResponsibleOption[] | null) ?? []
  const rateVersions = (rateVersionsRes.data as RateAssessmentVersion[] | null) ?? []
  const rateVersionIds = rateVersions.map(version => version.id)
  const rateItemsRes =
    rateFeatureEnabled && rateVersionIds.length > 0
      ? await supabase
          .from('rate_assessment_items')
          .select('*')
          .in('version_id', rateVersionIds)
          .order('axis')
      : { data: [] as RateAssessmentItem[] | null }
  const rateItems = (rateItemsRes.data as RateAssessmentItem[] | null) ?? []
  const rateSummary = rateAssessment
    ? {
        assessment: rateAssessment,
        latestVersion: rateVersions[0] ?? null,
        versionCount: rateVersions.length,
        versions: rateVersions,
        items: rateItems,
      }
    : null

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="page-title">Diagnóstico do projeto</h1>
        <p className="page-subtitle">
          Registre o diagnóstico principal, a baseline inicial e os indicadores-base de {project.project_name}.
        </p>
      </div>

      <DiagnosisWorkspace
        project={project}
        diagnosis={diagnosis}
        indicators={indicators}
        responsibles={responsibles}
        rateFeatureEnabled={rateFeatureEnabled}
        isAdmin={isAdmin}
        rateSummary={rateSummary}
      />
    </div>
  )
}
