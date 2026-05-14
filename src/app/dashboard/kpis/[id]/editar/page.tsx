import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { KpiForm } from '@/components/kpis/KpiForm'
import type { DiagnosisIndicator, Kpi, Profile, Project, UserRole } from '@/types/database.types'

export const metadata: Metadata = { title: 'Editar KPI' }

interface PageProps {
  params: { id: string }
}

type ProjectOption = Pick<Project, 'id' | 'project_name'>
type ResponsibleOption = Pick<Profile, 'id' | 'full_name'>
type ProjectPermissionLookup = Pick<Project, 'id' | 'project_name' | 'main_consultant_id'>
type DiagnosisIndicatorOption = Pick<
  DiagnosisIndicator,
  'id' | 'project_id' | 'area' | 'indicator_name' | 'baseline_value' | 'reference_date'
>
const RESPONSIBLE_ROLES: UserRole[] = ['admin_faus', 'gestor_faus', 'consultor_faus']

export default async function EditKpiPage({ params }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const supabase = await createClient()
  const { data } = await supabase
    .from('kpis')
    .select('*')
    .eq('id', params.id)
    .single()

  const kpi = (data as Kpi | null) ?? null

  if (!kpi) notFound()

  const projectPermissionRes = await supabase
    .from('projects')
    .select('id, project_name, main_consultant_id')
    .eq('id', kpi.project_id)
    .single()

  const projectPermission = (projectPermissionRes.data as ProjectPermissionLookup | null) ?? null
  const isAdmin = session.profile.role === 'admin_faus'
  const isLeadConsultant =
    session.profile.role === 'consultor_faus' &&
    projectPermission?.main_consultant_id === session.profile.id

  if (!isAdmin && !isLeadConsultant) redirect('/unauthorized?reason=forbidden')

  const [projectsRes, responsiblesRes, diagnosisIndicatorsRes] = await Promise.all([
    isAdmin
      ? supabase.from('projects').select('id, project_name').order('project_name')
      : Promise.resolve({ data: projectPermission ? [projectPermission] : [] as ProjectOption[] | null }),
    isAdmin
      ? supabase
          .from('profiles')
          .select('id, full_name')
          .in('role', RESPONSIBLE_ROLES)
          .eq('is_active', true)
          .order('full_name')
      : kpi.responsible_id && kpi.responsible_id !== session.profile.id
        ? supabase.from('profiles').select('id, full_name').in('id', [session.profile.id, kpi.responsible_id])
        : Promise.resolve({
            data: [{ id: session.profile.id, full_name: session.profile.full_name }] as ResponsibleOption[] | null,
          }),
    isAdmin
      ? supabase
          .from('diagnosis_indicators')
          .select('id, project_id, area, indicator_name, baseline_value, reference_date')
          .eq('is_active', true)
          .order('indicator_name')
      : supabase
          .from('diagnosis_indicators')
          .select('id, project_id, area, indicator_name, baseline_value, reference_date')
          .eq('project_id', kpi.project_id)
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
        <h1 className="page-title">Editar KPI</h1>
        <p className="page-subtitle">
          Atualize nome, meta, valor atual, status, tendência e visibilidade do indicador.
        </p>
      </div>

      <KpiForm
        mode="edit"
        initialData={kpi}
        projects={projects}
        responsibles={responsibles}
        diagnosisIndicators={diagnosisIndicators}
        diagnosisFeatureEnabled={diagnosisFeatureEnabled}
        canChooseProject={isAdmin}
        canEditUnitOfMeasure={isAdmin}
        canEditStructuralFields={isAdmin}
      />
    </div>
  )
}
