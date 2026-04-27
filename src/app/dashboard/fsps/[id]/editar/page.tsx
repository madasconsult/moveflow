import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { FspForm } from '@/components/fsp/FspForm'
import type { Action, Fsp, Kpi, KpiPeriodRecord, KpiTargetPeriod, Profile, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Editar FSP' }

interface PageProps {
  params: { id: string }
}

type ResponsibleOption = Pick<Profile, 'id' | 'full_name'>
type ActionOption = Pick<Action, 'id' | 'title' | 'status' | 'due_date'>
type ProjectLookup = Pick<Project, 'id' | 'project_name'>
type KpiLookup = Pick<Kpi, 'id' | 'project_id' | 'kpi_name' | 'unit_of_measure'>
type RecordLookup = Pick<KpiPeriodRecord, 'id' | 'kpi_id' | 'competence' | 'actual_value' | 'calculated_status' | 'justification'> & {
  target_period_id: string
}
type PeriodLookup = Pick<KpiTargetPeriod, 'id' | 'planned_target'>

export default async function EditFspPage({ params }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const supabase = await createClient()
  const { data: fspData } = await supabase
    .from('fsps')
    .select('*')
    .eq('id', params.id)
    .single()

  const fsp = (fspData as Fsp | null) ?? null
  if (!fsp) notFound()

  const [responsiblesRes, projectRes, actionsRes, linkedActionRes, generatedActionRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['admin_faus', 'consultor_faus'])
      .eq('is_active', true)
      .order('full_name'),
    supabase.from('projects').select('id, project_name').eq('id', fsp.project_id).single(),
    supabase
      .from('actions')
      .select('id, title, status, due_date')
      .eq('project_id', fsp.project_id)
      .order('due_date', { ascending: true, nullsFirst: false }),
    fsp.linked_action_id
      ? supabase.from('actions').select('id, title, status, due_date').eq('id', fsp.linked_action_id).single()
      : Promise.resolve({ data: null }),
    fsp.generated_action_id
      ? supabase.from('actions').select('id, title, status, due_date').eq('id', fsp.generated_action_id).single()
      : Promise.resolve({ data: null }),
  ])

  const responsibles = (responsiblesRes.data as ResponsibleOption[] | null) ?? []
  const project = (projectRes.data as ProjectLookup | null) ?? null
  const actionOptions = ((actionsRes.data as ActionOption[] | null) ?? []).filter(item => item.id !== fsp.generated_action_id)
  const existingLinkedAction = (linkedActionRes.data as ActionOption | null) ?? null
  const existingGeneratedAction = (generatedActionRes.data as ActionOption | null) ?? null

  if (!project) notFound()

  let sourceContext: Parameters<typeof FspForm>[0]['sourceContext'] | null = null

  if (fsp.source_type === 'kpi_period' && fsp.kpi_period_record_id) {
    const [recordRes, kpiRes] = await Promise.all([
      supabase
        .from('kpi_period_records')
        .select('id, kpi_id, competence, actual_value, calculated_status, justification, target_period_id')
        .eq('id', fsp.kpi_period_record_id)
        .single(),
      fsp.kpi_id
        ? supabase.from('kpis').select('id, project_id, kpi_name, unit_of_measure').eq('id', fsp.kpi_id).single()
        : Promise.resolve({ data: null }),
    ])

    const record = (recordRes.data as RecordLookup | null) ?? null
    const kpi = (kpiRes.data as KpiLookup | null) ?? null
    const periodRes = record
      ? await supabase.from('kpi_target_periods').select('id, planned_target').eq('id', record.target_period_id).single()
      : { data: null }
    const period = (periodRes.data as PeriodLookup | null) ?? null

    if (record && kpi) {
      sourceContext = {
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
      }
    }
  }

  if (fsp.source_type === 'action' && fsp.action_id) {
    const { data: actionData } = await supabase
      .from('actions')
      .select('id, project_id, title, status, due_date')
      .eq('id', fsp.action_id)
      .single()

    const action = (actionData as Pick<Action, 'id' | 'project_id' | 'title' | 'status' | 'due_date'> | null) ?? null

    if (action) {
      sourceContext = {
        sourceType: 'action',
        projectId: project.id,
        projectName: project.project_name,
        sourceId: action.id,
        actionId: action.id,
        actionTitle: action.title,
        actionStatus: action.status,
        dueDate: action.due_date,
      }
    }
  }

  if (!sourceContext) notFound()

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="page-title">Editar FSP</h1>
        <p className="page-subtitle">
          Continue a análise, consolide a causa raiz e escolha se a FSP será concluída, convertida em ação ou mantida em análise.
        </p>
      </div>

      <FspForm
        mode="edit"
        initialData={fsp}
        sourceContext={sourceContext}
        responsibles={responsibles}
        actionOptions={actionOptions}
        existingLinkedAction={existingLinkedAction}
        existingGeneratedAction={existingGeneratedAction}
      />
    </div>
  )
}
