import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Pencil, SearchCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { FspMethodView } from '@/components/fsp/FspMethodView'
import {
  ACTION_STATUS_LABELS,
  FSP_METHOD_TYPE_LABELS,
  FSP_SOURCE_TYPE_LABELS,
  FSP_STATUS_COLORS,
  FSP_STATUS_LABELS,
  PERFORMANCE_STATUS_COLORS,
  PERFORMANCE_STATUS_LABELS,
  formatDate,
  formatMeasurementValue,
} from '@/lib/utils'
import type { Action, Fsp, Kpi, KpiPeriodRecord, KpiTargetPeriod, Profile, Project } from '@/types/database.types'

export const metadata: Metadata = { title: 'Detalhe da FSP' }

interface PageProps {
  params: { id: string }
}

type ProjectLookup = Pick<Project, 'id' | 'project_name'>
type ResponsibleLookup = Pick<Profile, 'id' | 'full_name' | 'email'>
type ActionLookup = Pick<Action, 'id' | 'title' | 'status' | 'assigned_to' | 'due_date'>
type ActionResponsibleLookup = Pick<Profile, 'id' | 'full_name'>
type KpiLookup = Pick<Kpi, 'id' | 'kpi_name' | 'unit_of_measure'>
type RecordLookup = Pick<KpiPeriodRecord, 'id' | 'competence' | 'actual_value' | 'calculated_status' | 'justification'> & {
  target_period_id: string
}
type PeriodLookup = Pick<KpiTargetPeriod, 'id' | 'planned_target'>

export default async function FspDetailPage({ params }: PageProps) {
  const session = await getSessionWithProfile()

  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')
  if (session.profile.role === 'cliente') redirect('/portal')

  const supabase = await createClient()
  const { data } = await supabase
    .from('fsps')
    .select('*')
    .eq('id', params.id)
    .single()

  const fsp = (data as Fsp | null) ?? null
  if (!fsp) notFound()

  const [projectRes, ownerRes, kpiRes, sourceActionRes, linkedActionRes, generatedActionRes] = await Promise.all([
    supabase.from('projects').select('id, project_name').eq('id', fsp.project_id).single(),
    fsp.owner_id
      ? supabase.from('profiles').select('id, full_name, email').eq('id', fsp.owner_id).single()
      : Promise.resolve({ data: null }),
    fsp.kpi_id
      ? supabase.from('kpis').select('id, kpi_name, unit_of_measure').eq('id', fsp.kpi_id).single()
      : Promise.resolve({ data: null }),
    fsp.action_id
      ? supabase.from('actions').select('id, title, status, assigned_to, due_date').eq('id', fsp.action_id).single()
      : Promise.resolve({ data: null }),
    fsp.linked_action_id
      ? supabase.from('actions').select('id, title, status, assigned_to, due_date').eq('id', fsp.linked_action_id).single()
      : Promise.resolve({ data: null }),
    fsp.generated_action_id
      ? supabase.from('actions').select('id, title, status, assigned_to, due_date').eq('id', fsp.generated_action_id).single()
      : Promise.resolve({ data: null }),
  ])

  const project = (projectRes.data as ProjectLookup | null) ?? null
  const owner = (ownerRes.data as ResponsibleLookup | null) ?? null
  const kpi = (kpiRes.data as KpiLookup | null) ?? null
  const sourceAction = (sourceActionRes.data as ActionLookup | null) ?? null
  const linkedAction = (linkedActionRes.data as ActionLookup | null) ?? null
  const generatedAction = (generatedActionRes.data as ActionLookup | null) ?? null

  let record: RecordLookup | null = null
  let period: PeriodLookup | null = null

  if (fsp.kpi_period_record_id) {
    const { data: recordData } = await supabase
      .from('kpi_period_records')
      .select('id, competence, actual_value, calculated_status, justification, target_period_id')
      .eq('id', fsp.kpi_period_record_id)
      .single()

    record = (recordData as RecordLookup | null) ?? null

    if (record) {
      const { data: periodData } = await supabase
        .from('kpi_target_periods')
        .select('id, planned_target')
        .eq('id', record.target_period_id)
        .single()

      period = (periodData as PeriodLookup | null) ?? null
    }
  }

  const responsibleIds = Array.from(
    new Set(
      [sourceAction?.assigned_to, linkedAction?.assigned_to, generatedAction?.assigned_to].filter(Boolean) as string[]
    )
  )

  const responsiblesRes = responsibleIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', responsibleIds)
    : { data: [] as ActionResponsibleLookup[] | null }

  const actionResponsibleMap = new Map(
    (((responsiblesRes.data as ActionResponsibleLookup[] | null) ?? [])).map(item => [item.id, item.full_name])
  )

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">{fsp.title}</h1>
            <span className={`badge ${FSP_STATUS_COLORS[fsp.status]}`}>{FSP_STATUS_LABELS[fsp.status]}</span>
          </div>
          <p className="page-subtitle">
            Registro estruturado da análise de causa, com origem, método adotado, recomendação e desdobramento em ação.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/fsps" className="btn-secondary">Voltar</Link>
          <Link href={`/dashboard/fsps/${fsp.id}/editar`} className="btn-primary">
            <Pencil size={16} />
            Editar FSP
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <SearchCheck size={16} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Origem da análise</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 text-sm text-neutral-700">
              <div>
                <p className="mb-1 text-xs text-neutral-400">Projeto</p>
                <p>{project?.project_name ?? 'Projeto vinculado'}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Origem</p>
                <p>{FSP_SOURCE_TYPE_LABELS[fsp.source_type]}</p>
              </div>

              {fsp.source_type === 'kpi_period' && kpi && (
                <>
                  <div>
                    <p className="mb-1 text-xs text-neutral-400">KPI</p>
                    <Link href={`/dashboard/kpis/${kpi.id}`} className="text-brand-700 hover:text-brand-800">
                      {kpi.kpi_name}
                    </Link>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-neutral-400">Competência</p>
                    <p>{record?.competence ?? 'Período vinculado'}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-neutral-400">Meta</p>
                    <p>{formatMeasurementValue(period?.planned_target ?? null, kpi.unit_of_measure)}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-neutral-400">Realizado</p>
                    <p>{formatMeasurementValue(record?.actual_value ?? null, kpi.unit_of_measure)}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-neutral-400">Farol</p>
                    {record?.calculated_status ? (
                      <span className={`badge ${PERFORMANCE_STATUS_COLORS[record.calculated_status]}`}>
                        {PERFORMANCE_STATUS_LABELS[record.calculated_status]}
                      </span>
                    ) : (
                      <span>Sem farol</span>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <p className="mb-1 text-xs text-neutral-400">Justificativa da apuração</p>
                    <p className="whitespace-pre-wrap">{record?.justification ?? 'Sem justificativa registrada.'}</p>
                  </div>
                </>
              )}

              {fsp.source_type === 'action' && sourceAction && (
                <>
                  <div>
                    <p className="mb-1 text-xs text-neutral-400">Ação de origem</p>
                    <Link href={`/dashboard/acoes/${sourceAction.id}`} className="text-brand-700 hover:text-brand-800">
                      {sourceAction.title}
                    </Link>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-neutral-400">Status da ação</p>
                    <p>{ACTION_STATUS_LABELS[sourceAction.status]}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900">Síntese da FSP</h2>
            <div className="space-y-4 text-sm text-neutral-700">
              <div>
                <p className="mb-1 text-xs text-neutral-400">Problema</p>
                <p className="whitespace-pre-wrap">{fsp.problem_statement}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Impacto</p>
                <p className="whitespace-pre-wrap">{fsp.impact ?? 'Não informado.'}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Evidência</p>
                <p className="whitespace-pre-wrap">{fsp.evidence ?? 'Não informada.'}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Método</p>
                <p>{FSP_METHOD_TYPE_LABELS[fsp.method_type]}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Causa provável</p>
                <p className="whitespace-pre-wrap">{fsp.probable_cause ?? 'Não informada.'}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Causa raiz</p>
                <p className="whitespace-pre-wrap">{fsp.root_cause ?? 'Não informada.'}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Recomendação</p>
                <p className="whitespace-pre-wrap">{fsp.recommendation ?? 'Não informada.'}</p>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Visualização executiva do método</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Representação visual do raciocínio causal adotado nesta FSP.
                </p>
              </div>
              <span className="badge bg-slate-100 text-slate-700">
                {FSP_METHOD_TYPE_LABELS[fsp.method_type]}
              </span>
            </div>

            <FspMethodView fsp={fsp} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900">Governança</h2>
            <div className="space-y-3 text-sm text-neutral-700">
              <div>
                <p className="mb-1 text-xs text-neutral-400">Responsável</p>
                <p>{owner?.full_name ?? 'Não definido'}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Abertura</p>
                <p>{formatDate(fsp.opened_at)}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Fechamento</p>
                <p>{formatDate(fsp.closed_at)}</p>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900">Ações relacionadas</h2>
            <div className="space-y-4 text-sm text-neutral-700">
              <div>
                <p className="mb-1 text-xs text-neutral-400">Ação vinculada</p>
                {linkedAction ? (
                  <div className="space-y-1">
                    <Link href={`/dashboard/acoes/${linkedAction.id}`} className="text-brand-700 hover:text-brand-800">
                      {linkedAction.title} • {ACTION_STATUS_LABELS[linkedAction.status]}
                    </Link>
                    <p className="text-xs text-neutral-500">
                      Responsável: {linkedAction.assigned_to ? actionResponsibleMap.get(linkedAction.assigned_to) ?? 'Responsável vinculado' : 'Não definido'}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Prazo: {formatDate(linkedAction.due_date)}
                    </p>
                  </div>
                ) : (
                  <p>Nenhuma ação vinculada.</p>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-400">Ação gerada</p>
                {generatedAction ? (
                  <div className="space-y-1">
                    <Link href={`/dashboard/acoes/${generatedAction.id}`} className="text-brand-700 hover:text-brand-800">
                      {generatedAction.title} • {ACTION_STATUS_LABELS[generatedAction.status]}
                    </Link>
                    <p className="text-xs text-neutral-500">
                      Responsável: {generatedAction.assigned_to ? actionResponsibleMap.get(generatedAction.assigned_to) ?? 'Responsável vinculado' : 'Não definido'}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Prazo: {formatDate(generatedAction.due_date)}
                    </p>
                  </div>
                ) : (
                  <p>Nenhuma ação gerada.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
