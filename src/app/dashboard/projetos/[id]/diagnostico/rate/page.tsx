import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { RateAssessmentWorkspace } from '@/components/diagnosis/RateAssessmentWorkspace'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import type {
  Project,
  ProjectDiagnosis,
  RateAssessment,
  RateAssessmentItem,
  RateAssessmentVersion,
} from '@/types/database.types'

export const metadata: Metadata = { title: 'Rate FAUS do Diagnóstico' }

interface PageProps {
  params: { id: string }
}

type ProjectLookup = Pick<Project, 'id' | 'project_name'>

export default async function ProjectDiagnosisRatePage({ params }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')
  const canEdit = session.profile.role === 'admin_faus'

  const supabase = await createClient()

  const { data: projectData } = await supabase
    .from('projects')
    .select('id, project_name')
    .eq('id', params.id)
    .single()

  const project = (projectData as ProjectLookup | null) ?? null

  if (!project) notFound()

  const { data: diagnosisData } = await supabase
    .from('project_diagnoses')
    .select('*')
    .eq('project_id', project.id)
    .maybeSingle()

  const diagnosis = (diagnosisData as ProjectDiagnosis | null) ?? null

  if (!diagnosis) {
    return (
      <div className="max-w-4xl">
        <div className="card p-6">
          <h1 className="page-title">Rate FAUS do diagnóstico</h1>
          <p className="page-subtitle mt-2">
            Crie e salve o diagnóstico principal antes de trabalhar o Rate FAUS deste projeto.
          </p>
        </div>
      </div>
    )
  }

  const rateAssessmentRes = await supabase
    .from('rate_assessments')
    .select('*')
    .eq('diagnosis_id', diagnosis.id)
    .maybeSingle()

  const rateFeatureEnabled = !rateAssessmentRes.error
  const assessment = (rateAssessmentRes.data as RateAssessment | null) ?? null

  const versionsRes =
    rateFeatureEnabled && assessment
      ? await supabase
          .from('rate_assessment_versions')
          .select('*')
          .eq('assessment_id', assessment.id)
          .order('version_number', { ascending: false })
      : { data: [] as RateAssessmentVersion[] | null }

  const versions = (versionsRes.data as RateAssessmentVersion[] | null) ?? []
  const versionIds = versions.map(version => version.id)

  const itemsRes =
    rateFeatureEnabled && versionIds.length > 0
      ? await supabase
          .from('rate_assessment_items')
          .select('*')
          .in('version_id', versionIds)
          .order('axis')
      : { data: [] as RateAssessmentItem[] | null }

  const items = (itemsRes.data as RateAssessmentItem[] | null) ?? []

  return (
    <div className="max-w-7xl space-y-6">
      <RateAssessmentWorkspace
        project={project}
        featureEnabled={rateFeatureEnabled}
        assessment={assessment}
        versions={versions}
        items={items}
        canEdit={canEdit}
      />
    </div>
  )
}
