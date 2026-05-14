'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BarChart3, ChevronRight, Loader2, Sparkles } from 'lucide-react'
import { RateRadarChart } from '@/components/diagnosis/RateRadarChart'
import { createClient } from '@/lib/supabase/client'
import {
  RATE_PROFILE_LABELS,
  calculateRateAxisScores,
  createRateItemsForVersion,
  formatRateScore,
  getRateProfileTemplate,
} from '@/lib/rate-faus'
import type {
  InsertDto,
  RateAssessment,
  RateAssessmentItem,
  RateAssessmentVersion,
  RateProfileType,
} from '@/types/database.types'

interface RateSummary {
  assessment: RateAssessment
  latestVersion: RateAssessmentVersion | null
  versionCount: number
  versions: RateAssessmentVersion[]
  items: RateAssessmentItem[]
}

interface RateFausCardProps {
  projectId: string
  diagnosisId: string | null
  featureEnabled: boolean
  summary: RateSummary | null
  canEdit: boolean
  canReset?: boolean
}

export function RateFausCard({
  projectId,
  diagnosisId,
  featureEnabled,
  summary,
  canEdit,
  canReset = canEdit,
}: RateFausCardProps) {
  const router = useRouter()
  const supabase = createClient()
  const [dismissedAssessmentId, setDismissedAssessmentId] = useState<string | null>(null)
  const [isRefreshing, startRefreshTransition] = useTransition()
  const effectiveSummary =
    summary && summary.assessment.id !== dismissedAssessmentId ? summary : null
  const [enabledChoice, setEnabledChoice] = useState<'nao' | 'sim'>(effectiveSummary ? 'sim' : 'nao')
  const [profileType, setProfileType] = useState<RateProfileType>('distribuidor')
  const [versionName, setVersionName] = useState('Diagnóstico inicial')
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const rateUrl = useMemo(
    () => `/dashboard/projetos/${projectId}/diagnostico/rate`,
    [projectId]
  )
  const versionCards = useMemo(() => {
    if (!effectiveSummary) return []

    return [...effectiveSummary.versions]
      .sort((left, right) => left.version_number - right.version_number)
      .map(version => {
        const validCriteria = new Map(
          getRateProfileTemplate(version.profile_type).map(axis => [
            axis.axis,
            new Set(axis.criteria.map(criterion => criterion.criterion)),
          ])
        )
        const versionItems = effectiveSummary.items.filter(
          item =>
            item.version_id === version.id &&
            validCriteria.get(item.axis)?.has(item.criterion)
        )

        return {
          version,
          axisScores: calculateRateAxisScores(versionItems),
        }
      })
  }, [effectiveSummary])

  useEffect(() => {
    if (summary && summary.assessment.id !== dismissedAssessmentId) {
      setDismissedAssessmentId(null)
    }
  }, [summary, dismissedAssessmentId])

  useEffect(() => {
    setEnabledChoice(effectiveSummary ? 'sim' : 'nao')
  }, [effectiveSummary])

  async function handleActivate() {
    if (!canEdit) {
      setError('Você não tem permissão para ativar ou editar o Rate FAUS deste projeto.')
      return
    }

    if (!diagnosisId) {
      setError('Salve o diagnóstico principal antes de ativar o Rate FAUS.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { data: authData } = await supabase.auth.getUser()
      const assessmentsTable = supabase.from('rate_assessments') as any
      const versionsTable = supabase.from('rate_assessment_versions') as any
      const itemsTable = supabase.from('rate_assessment_items') as any

      const assessmentPayload: InsertDto<'rate_assessments'> = {
        project_id: projectId,
        diagnosis_id: diagnosisId,
        is_active: true,
      }

      const { data: assessmentData, error: assessmentError } = await assessmentsTable
        .insert(assessmentPayload)
        .select('id')
        .single()

      if (assessmentError || !assessmentData) {
        throw new Error(assessmentError?.message ?? 'Não foi possível ativar o Rate FAUS.')
      }

      const versionPayload: InsertDto<'rate_assessment_versions'> = {
        assessment_id: (assessmentData as { id: string }).id,
        version_number: 1,
        version_name: versionName.trim() || 'Diagnóstico inicial',
        assessment_date: assessmentDate,
        profile_type: profileType,
        overall_score: null,
        notes: notes.trim() || null,
        created_by: authData.user?.id ?? null,
      }

      const { data: versionData, error: versionError } = await versionsTable
        .insert(versionPayload)
        .select('id')
        .single()

      if (versionError || !versionData) {
        throw new Error(versionError?.message ?? 'Não foi possível criar a primeira versão do Rate.')
      }

      const itemsPayload = createRateItemsForVersion((versionData as { id: string }).id, profileType)
      const { error: itemsError } = await itemsTable.insert(itemsPayload)

      if (itemsError) {
        throw new Error(itemsError.message)
      }

      router.push(rateUrl)
      router.refresh()
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Não foi possível ativar o Rate FAUS. Tente novamente.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleResetRate() {
    if (!effectiveSummary || !canReset) return

    setResetting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { data, error: resetError } = await (supabase.rpc as any)('reset_rate_assessment', {
        p_assessment_id: effectiveSummary.assessment.id,
      })

      if (resetError) {
        throw new Error(resetError.message)
      }

      const result = Array.isArray(data) ? data[0] : data
      setDismissedAssessmentId(effectiveSummary.assessment.id)
      setShowResetConfirm(false)
      setSuccessMessage(
        `Rate FAUS resetado com sucesso. ${result?.versions_deleted ?? 0} versão(ões) e ${
          result?.items_deleted ?? 0
        } item(ns) foram removidos.`
      )
      startRefreshTransition(() => {
        router.refresh()
      })
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Não foi possível resetar o Rate FAUS. Tente novamente.'
      )
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            <Sparkles size={14} />
            Rate FAUS
          </div>
          <h2 className="mt-3 text-base font-semibold text-neutral-900">
            Complemento opcional do diagnóstico
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Estruture o diagnóstico em uma visão por eixos, versões e evolução de maturidade.
          </p>
        </div>

        {effectiveSummary && (
          <div className="flex items-center gap-3">
            <Link href={rateUrl} className="btn-secondary">
              <BarChart3 size={16} />
              Abrir Rate
            </Link>
            {canReset && (
              <button
                type="button"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                onClick={() => setShowResetConfirm(true)}
              >
                Resetar Rate FAUS
              </button>
            )}
          </div>
        )}
      </div>

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!featureEnabled ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          A estrutura do Rate FAUS ainda não está disponível neste banco. Aplique a migration correspondente
          para habilitar este bloco no diagnóstico.
        </div>
      ) : effectiveSummary ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">Versão atual</p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div>
                  <p className="text-lg font-semibold text-neutral-900">
                    {effectiveSummary.latestVersion?.version_name ?? 'Sem nome'}
                  </p>
                  <p className="text-sm text-neutral-500">
                    Perfil {effectiveSummary.latestVersion ? RATE_PROFILE_LABELS[effectiveSummary.latestVersion.profile_type] : '—'}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-600 shadow-sm">
                  {effectiveSummary.versionCount === 1 ? '1 versão' : `${effectiveSummary.versionCount} versões`}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-brand-100 bg-[linear-gradient(145deg,#eff6ff_0%,#f8fbff_100%)] px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-500">Resultado resumido</p>
              <p className="mt-3 text-3xl font-semibold text-brand-900">
                {formatRateScore(effectiveSummary.latestVersion?.overall_score ?? null)}
                <span className="text-base font-medium text-brand-700"> / 5,0</span>
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={rateUrl} className="btn-primary">
                  Ver visão completa
                </Link>
                {canEdit && (
                  <Link href={`${rateUrl}?newVersion=1`} className="btn-secondary">
                    Nova versão
                  </Link>
                )}
              </div>
            </div>
          </div>

          {versionCards.length > 0 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
                  Radares por versão
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  Compare visualmente a evolução do Rate FAUS a partir das versões já salvas no diagnóstico.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {versionCards.map(({ version, axisScores }) => (
                  <div key={version.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{version.version_name}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          v{version.version_number} • {RATE_PROFILE_LABELS[version.profile_type]} • {version.assessment_date}
                        </p>
                      </div>
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                        {formatRateScore(version.overall_score)} / 5,0
                      </span>
                    </div>

                    <RateRadarChart axes={axisScores} compact />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
          {!canEdit && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Apenas usuários autorizados podem ativar a primeira versão do Rate FAUS.
            </div>
          )}
          <div className="flex flex-wrap items-center gap-6">
            <label className="inline-flex items-center gap-3 text-sm font-medium text-neutral-800">
              <input
                type="radio"
                className="h-4 w-4 border-neutral-300 text-brand-600 focus:ring-brand-500"
                checked={enabledChoice === 'nao'}
                onChange={() => setEnabledChoice('nao')}
                disabled={saving || !canEdit}
              />
              Não
            </label>
            <label className="inline-flex items-center gap-3 text-sm font-medium text-neutral-800">
              <input
                type="radio"
                className="h-4 w-4 border-neutral-300 text-brand-600 focus:ring-brand-500"
                checked={enabledChoice === 'sim'}
                onChange={() => setEnabledChoice('sim')}
                disabled={saving || !canEdit}
              />
              Sim
            </label>
          </div>

          {enabledChoice === 'sim' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="rate_profile_type" className="label">Perfil</label>
                <select
                  id="rate_profile_type"
                  className="input"
                  value={profileType}
                  onChange={event => setProfileType(event.target.value as RateProfileType)}
                  disabled={saving || !canEdit}
                >
                  {Object.entries(RATE_PROFILE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="rate_assessment_date" className="label">Data da avaliação</label>
                <input
                  id="rate_assessment_date"
                  type="date"
                  className="input"
                  value={assessmentDate}
                  onChange={event => setAssessmentDate(event.target.value)}
                  disabled={saving || !canEdit}
                />
              </div>

              <div>
                <label htmlFor="rate_version_name" className="label">Nome da versão</label>
                <input
                  id="rate_version_name"
                  className="input"
                  value={versionName}
                  onChange={event => setVersionName(event.target.value)}
                  disabled={saving || !canEdit}
                  placeholder="Diagnóstico inicial"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="rate_notes" className="label">Notas iniciais</label>
                <textarea
                  id="rate_notes"
                  className="input min-h-24"
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                  disabled={saving || !canEdit}
                  placeholder="Contexto da avaliação, premissas ou recorte utilizado nesta primeira versão."
                />
              </div>
            </div>
          )}

          {enabledChoice === 'sim' && (
            <div className="flex items-center justify-end gap-3">
              <button type="button" className="btn-primary" onClick={handleActivate} disabled={saving || !canEdit}>
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Ativando Rate
                  </>
                ) : (
                  <>
                    Ativar Rate FAUS
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {showResetConfirm && effectiveSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4">
          <div className="w-full max-w-xl rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-red-500">
                  Ação destrutiva
                </p>
                <h3 className="mt-2 text-lg font-semibold text-neutral-900">Resetar Rate FAUS</h3>
                <p className="mt-2 text-sm text-neutral-600">
                  Esta ação vai apagar completamente o Rate FAUS deste diagnóstico.
                </p>
              </div>

              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-800">
                <ul className="space-y-2">
                  <li>A versão inicial será apagada.</li>
                  <li>Todas as reavaliações e versões posteriores serão apagadas.</li>
                  <li>Todos os critérios, notas e observações serão apagados.</li>
                  <li>O diagnóstico ficará sem Rate e poderá ser iniciado novamente do zero.</li>
                </ul>
              </div>

              {(resetting || isRefreshing) && (
                <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-4 text-sm text-brand-800">
                  Aguarde, apagando o Rate FAUS e preparando o diagnóstico para um novo início.
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowResetConfirm(false)}
                  disabled={resetting || isRefreshing}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                  onClick={handleResetRate}
                  disabled={resetting || isRefreshing}
                >
                  {resetting || isRefreshing ? (
                    <>
                      <Loader2 size={16} className="inline-block animate-spin mr-2" />
                      Resetando Rate...
                    </>
                  ) : (
                    'Confirmar reset'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
