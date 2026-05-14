import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { KpiForm } from '@/components/kpis/KpiForm'
import type { DiagnosisIndicator, Profile, Project, UserRole } from '@/types/database.types'

export const metadata: Metadata = { title: 'Novo KPI' }

type ProjectOption = Pick<Project, 'id' | 'project_name'>
type ResponsibleOption = Pick<Profile, 'id' | 'full_name'>
type DiagnosisIndicatorOption = Pick<
  DiagnosisIndicator,
  'id' | 'project_id' | 'area' | 'indicator_name' | 'baseline_value' | 'reference_date'
>
const RESPONSIBLE_ROLES: UserRole[] = ['admin_faus', 'gestor_faus', 'consultor_faus']

export default async function NewKpiPage() {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (!['admin_faus', 'consultor_faus'].includes(session.profile.role)) {
    redirect('/unauthorized?reason=forbidden')
  }

  const supabase = await createClient()
  const isAdmin = session.profile.role === 'admin_faus'
  const projectsRes = isAdmin
    ? await supabase.from('projects').select('id, project_name').order('project_name')
    : await supabase
        .from('projects')
        .select('id, project_name')
        .eq('main_consultant_id', session.profile.id)
        .order('project_name')

  const projects: ProjectOption[] = (projectsRes.data as ProjectOption[] | null) ?? []
  const projectIds = projects.map(project => project.id)

  const [responsiblesRes, diagnosisIndicatorsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', RESPONSIBLE_ROLES)
      .eq('is_active', true)
      .order('full_name'),
    projectIds.length > 0
      ? supabase
          .from('diagnosis_indicators')
          .select('id, project_id, area, indicator_name, baseline_value, reference_date')
          .in('project_id', projectIds)
          .eq('is_active', true)
          .order('indicator_name')
      : Promise.resolve({ data: [] as DiagnosisIndicatorOption[] | null, error: null }),
  ])

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
        canChooseProject={isAdmin || projects.length > 1}
        canEditStructuralFields
      />
    </div>
  )
}
