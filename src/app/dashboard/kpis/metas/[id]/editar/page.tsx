import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { KpiTargetPeriodForm } from '@/components/kpis/KpiTargetPeriodForm'
import type { Kpi, KpiTargetPeriod } from '@/types/database.types'

export const metadata: Metadata = { title: 'Editar Meta por Período' }

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

export default async function EditKpiTargetPeriodPage({ params, searchParams }: PageProps) {
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

  const period = (periodData as KpiTargetPeriod | null) ?? null
  if (!period) notFound()

  const [kpiRes, periodsRes] = await Promise.all([
    supabase
      .from('kpis')
      .select('id, kpi_name, reading_type')
      .eq('id', period.kpi_id)
      .single(),
    supabase
      .from('kpi_target_periods')
      .select('id, period_label, start_date, end_date, planned_target, green_threshold, yellow_threshold, red_threshold, notes, is_active')
      .eq('kpi_id', period.kpi_id),
  ])

  const kpi = (kpiRes.data as KpiLookup | null) ?? null
  if (!kpi) notFound()

  const existingPeriods = (periodsRes.data as ExistingPeriod[] | null) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Editar planejamento mensal</h1>
        <p className="page-subtitle">
          Ajuste a grade mensal da meta, com visão tabular para todo o ano selecionado.
        </p>
      </div>

      <KpiTargetPeriodForm
        mode="edit"
        kpi={kpi}
        initialData={period}
        existingPeriods={existingPeriods}
        defaultYear={searchParams?.year ? Number(searchParams.year) : undefined}
      />
    </div>
  )
}
