import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { KpiForm } from '@/components/kpis/KpiForm'
import type { DiagnosisIndicator, Profile, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Novo KPI' }

type ProjectOption = Pick<Project, 'id' | 'project_name'>
type ResponsibleOption = Pick<Profile, 'id' | 'full_name'>
type DiagnosisIndicatorOption = Pick<
  DiagnosisIndicator,
  'id' | 'project_id' | 'area' | 'indicator_name' | 'baseline_value' | 'reference_date'
>

export default async function NewKpiPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role !== 'admin_faus') redirect('/unauthorized?reason=forbidden')

  const supabase = await createClient()
  const [projectsRes, responsiblesRes, diagnosisIndicatorsRes] = await Promise.all([
    supabase.from('projects').select('id, project_name').order('project_name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['admin_faus', 'consultor_faus'])
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('diagnosis_indicators')
      .select('id, project_id, area, indicator_name, baseline_value, reference_date')
      .eq('is_active', true)
      .order('indicator_name'),
  ])

  const projects: ProjectOption[] = (projectsRes.data as ProjectOption[] | null) ?? []
  const responsibles: ResponsibleOption[] = (responsiblesRes.data as ResponsibleOption[] | null) ?? []
  const diagnosisIndicators: DiagnosisIndicatorOption[] =
    (diagnosisIndicatorsRes.data as DiagnosisIndicatorOption[] | null) ?? []
  const diagnosisFeatureEnabled = !diagnosisIndicatorsRes.error

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Novo KPI</h1>
        <p className="page-subtitle">
          Cadastre um indicador com meta, valor atual, tendência e visibilidade ao cliente.
        </p>
      </div>

      <KpiForm
        mode="create"
        projects={projects}
        responsibles={responsibles}
        diagnosisIndicators={diagnosisIndicators}
        diagnosisFeatureEnabled={diagnosisFeatureEnabled}
        canChooseProject
      />
    </div>
  )
}
