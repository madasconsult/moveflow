import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { KpiTargetPeriodForm } from '@/components/kpis/KpiTargetPeriodForm'
import type { Kpi, KpiTargetPeriod } from '@/types/database.types'

export const metadata: Metadata = { title: 'Nova Meta por Período' }

interface PageProps {
  params: { id: string }
  searchParams?: { year?: string }
}

type KpiLookup = Pick<Kpi, 'id' | 'kpi_name' | 'reading_type'>
type ExistingPeriod = Pick<
  KpiTargetPeriod,
  | 'id'
  | 'period_label'
  | 'start_date'
  | 'end_date'
  | 'planned_target'
  | 'green_threshold'
  | 'yellow_threshold'
  | 'red_threshold'
  | 'notes'
  | 'is_active'
>

export default async function NewKpiTargetPeriodPage({ params, searchParams }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')
  if (session.profile.role !== 'admin_faus') redirect('/unauthorized?reason=forbidden')

  const supabase = await createClient()
  const [kpiRes, periodsRes] = await Promise.all([
    supabase
      .from('kpis')
      .select('id, kpi_name, reading_type')
      .eq('id', params.id)
      .single(),
    supabase
      .from('kpi_target_periods')
      .select('id, period_label, start_date, end_date, planned_target, green_threshold, yellow_threshold, red_threshold, notes, is_active')
      .eq('kpi_id', params.id),
  ])

  const kpi = (kpiRes.data as KpiLookup | null) ?? null
  if (!kpi) notFound()

  const existingPeriods = (periodsRes.data as ExistingPeriod[] | null) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Planejamento mensal da meta</h1>
        <p className="page-subtitle">
          Estruture a meta anual em formato tabular, com edição mês a mês e faixas coerentes com a leitura do KPI.
        </p>
      </div>

      <KpiTargetPeriodForm
        mode="create"
        kpi={kpi}
        existingPeriods={existingPeriods}
        defaultYear={searchParams?.year ? Number(searchParams.year) : undefined}
      />
    </div>
  )
}
