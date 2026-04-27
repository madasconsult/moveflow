import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionWithProfile } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'
import { CheckSquare, CalendarDays, FileText, TrendingUp, ArrowRight, FolderKanban } from 'lucide-react'
import Link from 'next/link'
import {
  cn,
  formatMeasurementValue,
  DIAGNOSIS_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  PROJECT_PHASE_LABELS,
  STRATEGIC_FOCUS_LABELS,
} from '@/lib/utils'
import type {
  Action,
  DiagnosisIndicator,
  Kpi,
  Meeting,
  Project,
  ProjectDiagnosis,
  ProjectPhase,
  ProjectStatus,
  StrategicFocus,
} from '@/types/database.types'

export const metadata: Metadata = { title: 'Meu Projeto' }

export default async function PortalPage() {
  const session = await getSessionWithProfile()
  if (session.status === 'unauthenticated') redirect('/login')
  if (session.status === 'no_profile') redirect('/unauthorized?reason=no_profile')
  if (session.status === 'inactive') redirect('/unauthorized?reason=inactive')

  const { profile } = session
  if (profile.role !== 'cliente') redirect('/dashboard')

  const supabase = await createClient()

  // Busca o projeto do cliente (RLS garante que só vê o próprio)
  const { data: projectData } = await supabase
    .from('projects')
    .select('*')
    .single()

  const project = (projectData as Project | null) ?? null

  // Se cliente não tem projeto ainda
  if (!project) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-12 text-center">
          <FolderKanban size={40} className="text-neutral-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">
            Nenhum projeto encontrado
          </h2>
          <p className="text-sm text-neutral-500">
            Seu projeto ainda não foi configurado. Entre em contato com a equipe FAUS.
          </p>
        </div>
      </div>
    )
  }

  // Busca contadores (RLS filtra visible_to_client automaticamente)
  const [actionsRes, meetingsRes, docsRes, kpisRes, diagnosisRes] = await Promise.all([
    supabase
      .from('actions')
      .select('id, status', { count: 'exact' })
      .eq('project_id', project.id),
    supabase
      .from('meetings')
      .select('id, meeting_date, meeting_type', { count: 'exact' })
      .eq('project_id', project.id)
      .order('meeting_date', { ascending: false })
      .limit(1),
    supabase
      .from('documents')
      .select('id', { count: 'exact' })
      .eq('project_id', project.id),
    supabase
      .from('kpis')
      .select('id, kpi_name, current_value, target_value, unit_of_measure, status, trend', { count: 'exact' })
      .eq('project_id', project.id)
      .eq('classification', 'primary')
      .limit(3),
    supabase
      .from('project_diagnoses')
      .select('*')
      .eq('project_id', project.id)
      .eq('visible_to_client', true)
      .maybeSingle(),
  ])

  const actions: Action[] = (actionsRes.data as Action[] | null) ?? []
  const meetings: Meeting[] = (meetingsRes.data as Meeting[] | null) ?? []
  const lastMeeting = meetings[0] ?? null
  const kpis: Kpi[] = (kpisRes.data as Kpi[] | null) ?? []
  const diagnosis = (diagnosisRes.data as ProjectDiagnosis | null) ?? null

  const { data: diagnosisIndicatorsData } = diagnosis
    ? await supabase
        .from('diagnosis_indicators')
        .select('id, area, indicator_name, baseline_value, reference_date, unit_of_measure')
        .eq('diagnosis_id', diagnosis.id)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .limit(5)
    : { data: [] }

  const diagnosisIndicators = (diagnosisIndicatorsData as Array<
    Pick<DiagnosisIndicator, 'id' | 'area' | 'indicator_name' | 'baseline_value' | 'reference_date' | 'unit_of_measure'>
  > | null) ?? []

  const pendingActions = actions.filter(a =>
    ['not_started', 'in_progress', 'waiting_client'].includes(a.status)
  ).length

  const MEETING_TYPE_LABELS: Record<string, string> = {
    kickoff:       'Kick-off',
    followup:      'Follow-up',
    executive:     'Reunião Executiva',
    operational:   'Reunião Operacional',
    kpi_review:    'Análise de Indicadores',
    closure:       'Reunião de Encerramento',
    extraordinary: 'Reunião Extraordinária',
  }

  const KPI_STATUS_COLORS: Record<string, string> = {
    no_update:    'bg-neutral-100 text-neutral-500',
    updated:      'bg-blue-50 text-blue-700',
    at_risk:      'bg-yellow-50 text-yellow-700',
    below_target: 'bg-red-50 text-red-700',
    on_target:    'bg-green-50 text-green-700',
    above_target: 'bg-emerald-50 text-emerald-700',
    inactive:     'bg-neutral-100 text-neutral-400',
  }

  const KPI_STATUS_LABELS: Record<string, string> = {
    no_update:    'Sem atualização',
    updated:      'Atualizado',
    at_risk:      'Em Risco',
    below_target: 'Fora da Meta',
    on_target:    'Dentro da Meta',
    above_target: 'Acima da Meta',
    inactive:     'Inativo',
  }

  const TREND_ICONS: Record<string, string> = {
    improving: '↑',
    stable:    '→',
    worsening: '↓',
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Seu projeto
        </p>
        <h1 className="text-2xl font-semibold text-neutral-900">
          {project.project_name}
        </h1>
        {project.short_description && (
          <p className="text-sm text-neutral-500 mt-1">{project.short_description}</p>
        )}
      </div>

      {/* Status + fase + progresso */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <span className={cn(
            'badge text-xs',
            PROJECT_STATUS_COLORS[project.status as ProjectStatus] ?? 'bg-neutral-100 text-neutral-500'
          )}>
            {PROJECT_STATUS_LABELS[project.status as ProjectStatus] ?? project.status}
          </span>
          <span className="text-sm text-neutral-500">
            Fase: <span className="font-medium text-neutral-700">
              {PROJECT_PHASE_LABELS[project.phase as ProjectPhase] ?? project.phase}
            </span>
          </span>
        </div>

        {/* Barra de progresso */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Progresso geral</span>
            <span className="font-semibold text-neutral-900">{project.progress_percentage}%</span>
          </div>
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${project.progress_percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Direcionamento estratégico */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900">Direcionamento Estratégico</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">Foco do Projeto</p>
            <p className="text-sm font-medium text-neutral-800">
              {STRATEGIC_FOCUS_LABELS[project.strategic_focus as StrategicFocus] ?? project.strategic_focus}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">Objetivo Principal</p>
            <p className="text-sm text-neutral-800">{project.main_objective}</p>
          </div>
          {project.executive_scope && (
            <div className="sm:col-span-2">
              <p className="text-xs text-neutral-400 mb-0.5">Escopo Executivo</p>
              <p className="text-sm text-neutral-700 leading-relaxed">{project.executive_scope}</p>
            </div>
          )}
        </div>
      </div>

      {diagnosis && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Diagnóstico consolidado</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Visão inicial compartilhada do projeto e sua baseline executiva.
              </p>
            </div>
            <span className="badge bg-blue-50 text-blue-700">Liberado ao cliente</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs text-neutral-400 mb-1">Período do diagnóstico</p>
              <p className="text-sm text-neutral-700">
                {diagnosis.start_date ? new Intl.DateTimeFormat('pt-BR').format(new Date(diagnosis.start_date)) : '—'} até{' '}
                {diagnosis.end_date ? new Intl.DateTimeFormat('pt-BR').format(new Date(diagnosis.end_date)) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 mb-1">Status</p>
              <p className="text-sm text-neutral-700">{DIAGNOSIS_STATUS_LABELS[diagnosis.status]}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs text-neutral-400 mb-1">Resumo executivo</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                {diagnosis.executive_summary ?? 'Resumo não informado.'}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs text-neutral-400 mb-1">Principais achados</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                {diagnosis.key_findings ?? 'Achados não informados.'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200">
            <div className="border-b border-neutral-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-neutral-900">Indicadores-base</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Área</th>
                    <th className="px-4 py-3">Indicador</th>
                    <th className="px-4 py-3">Baseline</th>
                    <th className="px-4 py-3">Referência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white">
                  {diagnosisIndicators.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-neutral-500">
                        Nenhum indicador-base foi publicado neste diagnóstico.
                      </td>
                    </tr>
                  ) : (
                    diagnosisIndicators.map(indicator => (
                      <tr key={indicator.id}>
                        <td className="px-4 py-3 text-neutral-700">{indicator.area}</td>
                        <td className="px-4 py-3 text-neutral-900">{indicator.indicator_name}</td>
                        <td className="px-4 py-3 text-neutral-700">
                          {formatMeasurementValue(indicator.baseline_value, indicator.unit_of_measure)}
                        </td>
                        <td className="px-4 py-3 text-neutral-700">
                          {indicator.reference_date
                            ? new Intl.DateTimeFormat('pt-BR').format(new Date(indicator.reference_date))
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Cards de módulos */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label:   'Ações pendentes',
            value:   pendingActions,
            total:   actions.length,
            icon:    CheckSquare,
            href:    '/portal/acoes',
            color:   'text-blue-600',
            bg:      'bg-blue-50',
          },
          {
            label:   'Reuniões',
            value:   meetingsRes.count ?? 0,
            icon:    CalendarDays,
            href:    '/portal/reunioes',
            color:   'text-purple-600',
            bg:      'bg-purple-50',
          },
          {
            label:   'Documentos',
            value:   docsRes.count ?? 0,
            icon:    FileText,
            href:    '/portal/documentos',
            color:   'text-orange-600',
            bg:      'bg-orange-50',
          },
          {
            label:   'Indicadores',
            value:   kpisRes.count ?? 0,
            icon:    TrendingUp,
            href:    '/portal/kpis',
            color:   'text-green-600',
            bg:      'bg-green-50',
          },
        ].map(card => {
          const Icon = card.icon
          return (
            <Link key={card.href} href={card.href} className="card-hover p-5 group">
              <div className="flex items-start justify-between mb-3">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', card.bg)}>
                  <Icon size={18} className={card.color} />
                </div>
                <ArrowRight
                  size={14}
                  className="text-neutral-300 group-hover:text-neutral-500 group-hover:translate-x-0.5 transition-all"
                />
              </div>
              <p className="text-2xl font-semibold text-neutral-900">
                {card.value}
                {'total' in card && card.total !== undefined && (
                  <span className="text-sm font-normal text-neutral-400 ml-1">/ {card.total}</span>
                )}
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">{card.label}</p>
            </Link>
          )
        })}
      </div>

      {/* KPIs principais + Última reunião */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* KPIs */}
        {kpis.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <TrendingUp size={15} className="text-neutral-400" />
                <h3 className="text-sm font-semibold text-neutral-900">Indicadores principais</h3>
              </div>
              <Link href="/portal/kpis" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                Ver todos <ArrowRight size={11} />
              </Link>
            </div>
            <div className="divide-y divide-neutral-100">
              {kpis.map(kpi => (
                <div key={kpi.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{kpi.kpi_name}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Meta: {kpi.target_value ?? '—'} {kpi.unit_of_measure ?? ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-base font-semibold text-neutral-900">
                      {kpi.current_value ?? '—'}
                      {kpi.unit_of_measure && (
                        <span className="text-xs font-normal text-neutral-400 ml-0.5">
                          {kpi.unit_of_measure}
                        </span>
                      )}
                    </span>
                    {kpi.trend && (
                      <span className="text-sm">{TREND_ICONS[kpi.trend]}</span>
                    )}
                    <span className={cn('badge text-[11px]', KPI_STATUS_COLORS[kpi.status])}>
                      {KPI_STATUS_LABELS[kpi.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Última reunião */}
        {lastMeeting && (
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <CalendarDays size={15} className="text-neutral-400" />
                <h3 className="text-sm font-semibold text-neutral-900">Última reunião</h3>
              </div>
              <Link href="/portal/reunioes" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                Ver todas <ArrowRight size={11} />
              </Link>
            </div>
            <div className="px-5 py-4 space-y-1">
              <p className="text-sm font-medium text-neutral-900">
                {MEETING_TYPE_LABELS[lastMeeting.meeting_type] ?? lastMeeting.meeting_type}
              </p>
              <p className="text-xs text-neutral-400">
                {new Intl.DateTimeFormat('pt-BR', {
                  day: '2-digit', month: 'long', year: 'numeric',
                }).format(new Date(lastMeeting.meeting_date))}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
