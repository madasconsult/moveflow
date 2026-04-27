import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { FspForm } from '@/components/fsp/FspForm'
import type { Action, Kpi, KpiPeriodRecord, KpiTargetPeriod, Profile, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Nova FSP' }

interface PageProps {
  searchParams?: {
    sourceType?: string
    recordId?: string
    actionId?: string
  }
}

type ResponsibleOption = Pick<Profile, 'id' | 'full_name'>
type ActionOption = Pick<Action, 'id' | 'title' | 'status' | 'due_date'>
type ProjectLookup = Pick<Project, 'id' | 'project_name'>
type KpiLookup = Pick<Kpi, 'id' | 'project_id' | 'kpi_name' | 'unit_of_measure'>
type RecordLookup = Pick<KpiPeriodRecord, 'id' | 'kpi_id' | 'competence' | 'actual_value' | 'calculated_status' | 'justification'> & {
  target_period_id: string
}
type PeriodLookup = Pick<KpiTargetPeriod, 'id' | 'planned_target'>

export default async function NewFspPage({ searchParams }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const sourceType = searchParams?.sourceType
  const recordId = searchParams?.recordId
  const actionId = searchParams?.actionId

  if (sourceType !== 'kpi_period' && sourceType !== 'action') notFound()

  const supabase = await createClient()

  const responsiblesRes = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['admin_faus', 'consultor_faus'])
    .eq('is_active', true)
    .order('full_name')

  const responsibles = (responsiblesRes.data as ResponsibleOption[] | null) ?? []

  if (sourceType === 'kpi_period') {
    if (!recordId) notFound()

    const { data: recordData } = await supabase
      .from('kpi_period_records')
      .select('id, kpi_id, competence, actual_value, calculated_status, justification, target_period_id')
      .eq('id', recordId)
      .single()

    const record = (recordData as RecordLookup | null) ?? null
    if (!record) notFound()

    const [kpiRes, periodRes] = await Promise.all([
      supabase.from('kpis').select('id, project_id, kpi_name, unit_of_measure').eq('id', record.kpi_id).single(),
      supabase.from('kpi_target_periods').select('id, planned_target').eq('id', record.target_period_id).single(),
    ])

    const kpi = (kpiRes.data as KpiLookup | null) ?? null
    const period = (periodRes.data as PeriodLookup | null) ?? null
    if (!kpi) notFound()

    const [projectRes, actionsRes] = await Promise.all([
      supabase.from('projects').select('id, project_name').eq('id', kpi.project_id).single(),
      supabase
        .from('actions')
        .select('id, title, status, due_date')
        .eq('project_id', kpi.project_id)
        .order('due_date', { ascending: true, nullsFirst: false }),
    ])

    const project = (projectRes.data as ProjectLookup | null) ?? null
    const actionOptions = (actionsRes.data as ActionOption[] | null) ?? []
    if (!project) notFound()

    return (
      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="page-title">Nova FSP a partir do KPI / período</h1>
          <p className="page-subtitle">
            Registre o problema, escolha o método de análise e conclua com ação vinculada ou gerada quando necessário.
          </p>
        </div>

        <FspForm
          mode="create"
          sourceContext={{
            sourceType: 'kpi_period',
            projectId: project.id,
            projectName: project.project_name,
            sourceId: record.id,
            kpiId: kpi.id,
            kpiName: kpi.kpi_name,
            competence: record.competence,
            plannedTarget: period?.planned_target ?? null,
            actualValue: record.actual_value,
            calculatedStatus: record.calculated_status,
            justification: record.justification,
            unitOfMeasure: kpi.unit_of_measure,
          }}
          responsibles={responsibles}
          actionOptions={actionOptions}
        />
      </div>
    )
  }

  if (!actionId) notFound()

  const { data: actionData } = await supabase
    .from('actions')
    .select('id, project_id, title, status, due_date')
    .eq('id', actionId)
    .single()

  const action = (actionData as Pick<Action, 'id' | 'project_id' | 'title' | 'status' | 'due_date'> | null) ?? null
  if (!action) notFound()

  const [projectRes, actionsRes] = await Promise.all([
    supabase.from('projects').select('id, project_name').eq('id', action.project_id).single(),
    supabase
      .from('actions')
      .select('id, title, status, due_date')
      .eq('project_id', action.project_id)
      .order('due_date', { ascending: true, nullsFirst: false }),
  ])

  const project = (projectRes.data as ProjectLookup | null) ?? null
  const actionOptions = ((actionsRes.data as ActionOption[] | null) ?? []).filter(item => item.id !== action.id)
  if (!project) notFound()

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="page-title">Nova FSP a partir da ação</h1>
        <p className="page-subtitle">
          Estruture a análise da causa, consolide a recomendação e decida se a FSP gera ou vincula uma ação.
        </p>
      </div>

      <FspForm
        mode="create"
        sourceContext={{
          sourceType: 'action',
          projectId: project.id,
          projectName: project.project_name,
          sourceId: action.id,
          actionId: action.id,
          actionTitle: action.title,
          actionStatus: action.status,
          dueDate: action.due_date,
        }}
        responsibles={responsibles}
        actionOptions={actionOptions}
      />
    </div>
  )
}
