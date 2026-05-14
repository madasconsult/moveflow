import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { KpiPeriodRecordForm } from '@/components/kpis/KpiPeriodRecordForm'
import type { Kpi, KpiPeriodRecord, KpiTargetPeriod, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Apuração do KPI' }

interface PageProps {
  params: { id: string }
}

type KpiLookup = Pick<Kpi, 'id' | 'project_id' | 'kpi_name' | 'reading_type' | 'unit_of_measure' | 'current_value'>
type ProjectPermissionLookup = Pick<Project, 'id' | 'main_consultant_id'>

export default async function KpiPeriodRecordPage({ params }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const supabase = await createClient()
  const { data: periodData } = await supabase
    .from('kpi_target_periods')
    .select('*')
    .eq('id', params.id)
    .single()

  const targetPeriod = (periodData as KpiTargetPeriod | null) ?? null
  if (!targetPeriod) notFound()

  const [kpiRes, recordRes] = await Promise.all([
    supabase
      .from('kpis')
      .select('id, project_id, kpi_name, reading_type, unit_of_measure, current_value')
      .eq('id', targetPeriod.kpi_id)
      .single(),
    supabase
      .from('kpi_period_records')
      .select('*')
      .eq('target_period_id', targetPeriod.id)
      .maybeSingle(),
  ])

  const kpi = (kpiRes.data as KpiLookup | null) ?? null
  const record = (recordRes.data as KpiPeriodRecord | null) ?? null

  if (!kpi) notFound()

  const projectRes = await supabase
    .from('projects')
    .select('id, main_consultant_id')
    .eq('id', kpi.project_id)
    .single()
  const project = (projectRes.data as ProjectPermissionLookup | null) ?? null
  const canManageKpi =
    session.profile.role === 'admin_faus' ||
    (session.profile.role === 'consultor_faus' && project?.main_consultant_id === session.profile.id)

  if (!canManageKpi) redirect('/unauthorized?reason=forbidden')

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="page-title">
          {record ? 'Editar apuração do período' : 'Registrar apuração do período'}
        </h1>
        <p className="page-subtitle">
          Informe o realizado do período, com farol automático, justificativa e análise resumida.
        </p>
        {record && (
          <div className="mt-3">
            <Link
              href={`/dashboard/fsps/novo?sourceType=kpi_period&recordId=${record.id}`}
              className="btn-secondary"
            >
              Abrir FSP deste período
            </Link>
          </div>
        )}
      </div>

      <KpiPeriodRecordForm
        mode={record ? 'edit' : 'create'}
        kpi={kpi}
        targetPeriod={targetPeriod}
        initialData={record ?? undefined}
      />
    </div>
  )
}
