'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, Loader2, Plus, Radar, Scale, Table2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  RATE_PROFILE_LABELS,
  buildRateVersionSeries,
  calculateRateAxisScores,
  calculateRateOverallScore,
  calculateWeightedScore,
  createRateItemsForVersion,
  formatRateScore,
  formatRateWeight,
  getRateCriterionDefinition,
  getRateProfileTemplate,
  getRateScoreDescription,
  getRateScoreOptions,
} from '@/lib/rate-faus'
import { RateEvolutionChart } from '@/components/diagnosis/RateEvolutionChart'
import { RateGauge } from '@/components/diagnosis/RateGauge'
import { RateRadarChart } from '@/components/diagnosis/RateRadarChart'
import { formatDate } from '@/lib/utils'
import type {
  InsertDto,
  Project,
  RateAssessment,
  RateAssessmentItem,
  RateAssessmentVersion,
  RateProfileType,
  UpdateDto,
} from '@/types/database.types'

interface RateAssessmentWorkspaceProps {
  project: Pick<Project, 'id' | 'project_name'>
  featureEnabled: boolean
  assessment: RateAssessment | null
  versions: RateAssessmentVersion[]
  items: RateAssessmentItem[]
  canEdit: boolean
}

interface ItemDraft {
  score: string
  notes: string
}

export function RateAssessmentWorkspace({
  project,
  featureEnabled,
  assessment,
  versions,
  items,
  canEdit,
}: RateAssessmentWorkspaceProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const orderedVersions = useMemo(
    () => [...versions].sort((left, right) => right.version_number - left.version_number),
    [versions]
  )
  const initialVersionId = searchParams.get('version') ?? orderedVersions[0]?.id ?? null
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(initialVersionId)
  const [selectedAxis, setSelectedAxis] = useState<string | null>(null)
  const [showNewVersionForm, setShowNewVersionForm] = useState(searchParams.get('newVersion') === '1')
  const [saving, setSaving] = useState(false)
  const [creatingVersion, setCreatingVersion] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const [versionName, setVersionName] = useState('')
  const [assessmentDate, setAssessmentDate] = useState('')
  const [versionNotes, setVersionNotes] = useState('')
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({})

  const [newVersionName, setNewVersionName] = useState('Reavaliação')
  const [newAssessmentDate, setNewAssessmentDate] = useState(new Date().toISOString().slice(0, 10))
  const [newProfileType, setNewProfileType] = useState<RateProfileType>(
    orderedVersions[0]?.profile_type ?? 'distribuidor'
  )
  const [newVersionNotes, setNewVersionNotes] = useState('')

  const itemsByVersion = useMemo(() => {
    const grouped = new Map<string, RateAssessmentItem[]>()

    for (const item of items) {
      const current = grouped.get(item.version_id) ?? []
      current.push(item)
      grouped.set(item.version_id, current)
    }

    return grouped
  }, [items])

  const selectedVersion = orderedVersions.find(version => version.id === selectedVersionId) ?? null
  const selectedItems = useMemo(() => {
    if (!selectedVersion) return []

    const versionItems = itemsByVersion.get(selectedVersion.id) ?? []
    const allowedCriteria = new Map(
      getRateProfileTemplate(selectedVersion.profile_type).map(axis => [
        axis.axis,
        new Set(axis.criteria.map(criterion => criterion.criterion)),
      ])
    )

    return versionItems.filter(item => allowedCriteria.get(item.axis)?.has(item.criterion))
  }, [itemsByVersion, selectedVersion])
  const selectedTemplate = useMemo(
    () => (selectedVersion ? getRateProfileTemplate(selectedVersion.profile_type) : []),
    [selectedVersion]
  )
  const axisScores = useMemo(() => {
    const scores = calculateRateAxisScores(selectedItems)
    const order = new Map(selectedTemplate.map((axis, index) => [axis.axis, index]))
    return scores.sort(
      (left, right) => (order.get(left.axis) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.axis) ?? Number.MAX_SAFE_INTEGER)
    )
  }, [selectedItems, selectedTemplate])
  const overallScore = useMemo(() => calculateRateOverallScore(selectedItems), [selectedItems])
  const versionSeries = useMemo(() => buildRateVersionSeries(orderedVersions), [orderedVersions])

  useEffect(() => {
    if (!selectedVersion && orderedVersions[0]) {
      setSelectedVersionId(orderedVersions[0].id)
    }
  }, [orderedVersions, selectedVersion])

  useEffect(() => {
    if (!selectedVersion) return

    setVersionName(selectedVersion.version_name)
    setAssessmentDate(selectedVersion.assessment_date)
    setVersionNotes(selectedVersion.notes ?? '')

    const nextDrafts: Record<string, ItemDraft> = {}
    for (const item of selectedItems) {
      nextDrafts[item.id] = {
        score: item.score === null ? '' : item.score.toString(),
        notes: item.notes ?? '',
      }
    }
    setDrafts(nextDrafts)

    if (!selectedAxis && selectedTemplate[0]) {
      setSelectedAxis(selectedTemplate[0].axis)
    } else if (selectedAxis && !selectedTemplate.some(axis => axis.axis === selectedAxis)) {
      setSelectedAxis(selectedTemplate[0]?.axis ?? null)
    }
  }, [selectedVersion, selectedItems, selectedAxis, selectedTemplate])

  const selectedAxisItems = useMemo(
    () => selectedItems.filter(item => item.axis === selectedAxis),
    [selectedAxis, selectedItems]
  )
  const selectedAxisScore = useMemo(
    () => axisScores.find(axis => axis.axis === selectedAxis) ?? null,
    [axisScores, selectedAxis]
  )

  const comparisonRows = useMemo(() => {
    if (orderedVersions.length < 2) return []

    const axisNames = selectedTemplate.map(axis => axis.axis)

    return axisNames.map(axis => {
      const versionValues = orderedVersions
        .slice()
        .sort((left, right) => left.version_number - right.version_number)
        .map(version => {
          const validCriteria = new Set(
            getRateProfileTemplate(version.profile_type)
              .find(entry => entry.axis === axis)
              ?.criteria.map(entry => entry.criterion) ?? []
          )
          const versionItems = (itemsByVersion.get(version.id) ?? []).filter(
            item => item.axis === axis && validCriteria.has(item.criterion)
          )
          const score = calculateRateAxisScores(versionItems)[0]?.score ?? null
          return { version, score }
        })

      const first = versionValues[0]?.score
      const last = versionValues[versionValues.length - 1]?.score

      return {
        axis,
        versionValues,
        variation:
          first === null || last === null ? null : Number((last - first).toFixed(2)),
      }
    })
  }, [itemsByVersion, orderedVersions, selectedTemplate])

  function updateItemDraft(itemId: string, field: keyof ItemDraft, value: string) {
    if (!canEdit) return
    setSaveMessage(null)
    setDrafts(current => ({
      ...current,
      [itemId]: {
        score: current[itemId]?.score ?? '',
        notes: current[itemId]?.notes ?? '',
        [field]: value,
      },
    }))
  }

  function parseDraftScore(score: string | undefined) {
    if (score === '' || score === undefined) return null
    return Number(score)
  }

  function buildDraftEntry(item: RateAssessmentItem) {
    const draft = drafts[item.id]
    const score = parseDraftScore(draft?.score)

    return {
      item,
      score,
      weightedScore: calculateWeightedScore(score, Number(item.weight)),
      notes: draft?.notes.trim() || null,
    }
  }

  async function handleSaveVersion() {
    if (!selectedVersion || !canEdit) return

    setSaving(true)
    setError(null)
    setSaveMessage(null)

    try {
      const versionsTable = supabase.from('rate_assessment_versions') as any
      const versionPayload: UpdateDto<'rate_assessment_versions'> = {
        version_name: versionName.trim() || selectedVersion.version_name,
        assessment_date: assessmentDate || selectedVersion.assessment_date,
        notes: versionNotes.trim() || null,
        overall_score: selectedVersion.overall_score,
      }

      const { error: versionError } = await versionsTable
        .update(versionPayload)
        .eq('id', selectedVersion.id)

      if (versionError) {
        throw new Error(versionError.message)
      }

      setSaveMessage('Dados da versão salvos com sucesso.')
      router.refresh()
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Não foi possível salvar a versão do Rate. Tente novamente.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAxis() {
    if (!selectedVersion || !selectedAxis || selectedAxisItems.length === 0 || !canEdit) return

    setSaving(true)
    setError(null)
    setSaveMessage(null)

    try {
      const versionsTable = supabase.from('rate_assessment_versions') as any
      const itemsTable = supabase.from('rate_assessment_items') as any
      const axisEntries = selectedAxisItems.map(buildDraftEntry)

      const mergedItems = selectedItems.map(item => {
        const updated = axisEntries.find(entry => entry.item.id === item.id)
        return updated
          ? { weight: updated.item.weight, score: updated.score }
          : { weight: item.weight, score: item.score }
      })

      const updatePromises = axisEntries.map(entry =>
        itemsTable
          .update({
            score: entry.score,
            weighted_score: entry.weightedScore,
            notes: entry.notes,
          })
          .eq('id', entry.item.id)
      )

      const itemResults = await Promise.all(updatePromises)
      const itemError = itemResults.find(result => result.error)?.error

      if (itemError) {
        throw new Error(itemError.message)
      }

      const { error: versionError } = await versionsTable
        .update({
          overall_score: calculateRateOverallScore(mergedItems),
        })
        .eq('id', selectedVersion.id)

      if (versionError) {
        throw new Error(versionError.message)
      }

      setSaveMessage(`Avaliação do eixo ${selectedAxis} salva com sucesso.`)
      router.refresh()
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Não foi possível salvar a avaliação do eixo. Tente novamente.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateVersion() {
    if (!assessment || !canEdit) return

    setCreatingVersion(true)
    setError(null)

    try {
      const { data: authData } = await supabase.auth.getUser()
      const versionsTable = supabase.from('rate_assessment_versions') as any
      const itemsTable = supabase.from('rate_assessment_items') as any
      const nextVersionNumber = Math.max(0, ...orderedVersions.map(version => version.version_number)) + 1

      const versionPayload: InsertDto<'rate_assessment_versions'> = {
        assessment_id: assessment.id,
        version_number: nextVersionNumber,
        version_name: newVersionName.trim() || `Versão ${nextVersionNumber}`,
        assessment_date: newAssessmentDate,
        profile_type: newProfileType,
        overall_score: null,
        notes: newVersionNotes.trim() || null,
        created_by: authData.user?.id ?? null,
      }

      const { data: versionData, error: versionError } = await versionsTable
        .insert(versionPayload)
        .select('id')
        .single()

      if (versionError || !versionData) {
        throw new Error(versionError?.message ?? 'Não foi possível criar a nova versão.')
      }

      const versionId = (versionData as { id: string }).id
      const itemsPayload = createRateItemsForVersion(versionId, newProfileType)
      const { error: itemsError } = await itemsTable.insert(itemsPayload)

      if (itemsError) {
        throw new Error(itemsError.message)
      }

      setShowNewVersionForm(false)
      router.push(`/dashboard/projetos/${project.id}/diagnostico/rate?version=${versionId}`)
      router.refresh()
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Não foi possível criar a nova versão do Rate.'
      )
    } finally {
      setCreatingVersion(false)
    }
  }

  if (!featureEnabled) {
    return (
      <div className="card p-6">
        <h2 className="text-base font-semibold text-neutral-900">Rate FAUS indisponível</h2>
        <p className="mt-2 text-sm text-neutral-500">
          A estrutura do Rate ainda não foi aplicada neste banco. Habilite a migration correspondente para
          usar o complemento do diagnóstico.
        </p>
      </div>
    )
  }

  if (!assessment) {
    return (
      <div className="card p-6 space-y-4">
        <h2 className="text-base font-semibold text-neutral-900">Rate FAUS ainda não ativado</h2>
        <p className="text-sm text-neutral-500">
          O diagnóstico de {project.project_name} ainda não possui uma avaliação estruturada do Rate FAUS.
        </p>
        <Link href={`/dashboard/projetos/${project.id}/diagnostico`} className="btn-primary">
          Voltar ao diagnóstico
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-500">Rate FAUS</p>
          <h1 className="page-title mt-2">Avaliação estruturada do diagnóstico</h1>
          <p className="page-subtitle">
            Trabalhe versões, score por eixo, radar e evolução do Rate vinculado ao diagnóstico de {project.project_name}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/projetos/${project.id}/diagnostico`} className="btn-secondary">
            Voltar ao diagnóstico
          </Link>
          {canEdit && (
            <button type="button" className="btn-primary" onClick={() => setShowNewVersionForm(true)}>
              <Plus size={16} />
              Nova versão
            </button>
          )}
        </div>
      </div>

      {!canEdit && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          O Rate FAUS está em modo somente leitura para este perfil neste projeto.
        </div>
      )}

      {showNewVersionForm && (
        <div className="card p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Nova versão do Rate</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Registre uma nova fotografia de maturidade sem apagar a versão anterior.
              </p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setShowNewVersionForm(false)}>
              Fechar
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="new_rate_version_name" className="label">Nome da versão</label>
              <input
                id="new_rate_version_name"
                className="input"
                value={newVersionName}
                onChange={event => setNewVersionName(event.target.value)}
                disabled={creatingVersion}
              />
            </div>
            <div>
              <label htmlFor="new_rate_assessment_date" className="label">Data da avaliação</label>
              <input
                id="new_rate_assessment_date"
                type="date"
                className="input"
                value={newAssessmentDate}
                onChange={event => setNewAssessmentDate(event.target.value)}
                disabled={creatingVersion}
              />
            </div>
            <div>
              <label htmlFor="new_rate_profile" className="label">Perfil</label>
              <select
                id="new_rate_profile"
                className="input"
                value={newProfileType}
                onChange={event => setNewProfileType(event.target.value as RateProfileType)}
                disabled={creatingVersion}
              >
                {Object.entries(RATE_PROFILE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="new_rate_notes" className="label">Notas da versão</label>
              <textarea
                id="new_rate_notes"
                className="input min-h-24"
                value={newVersionNotes}
                onChange={event => setNewVersionNotes(event.target.value)}
                disabled={creatingVersion}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-primary" onClick={handleCreateVersion} disabled={creatingVersion}>
              {creatingVersion ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Criando versão
                </>
              ) : (
                <>
                  Criar versão
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {saveMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {saveMessage}
        </div>
      )}

      {selectedVersion && (
        <>
          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <RateGauge score={overallScore} />
            <RateRadarChart axes={axisScores} />
          </div>

          <div className="card p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">Versão selecionada</p>
                <h2 className="mt-2 text-base font-semibold text-neutral-900">{selectedVersion.version_name}</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {RATE_PROFILE_LABELS[selectedVersion.profile_type]} • {formatDate(selectedVersion.assessment_date)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  className="input min-w-[16rem]"
                  value={selectedVersion.id}
                  onChange={event => setSelectedVersionId(event.target.value)}
                  disabled={saving}
                >
                  {orderedVersions.map(version => (
                    <option key={version.id} value={version.id}>
                      v{version.version_number} — {version.version_name}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn-primary" onClick={handleSaveVersion} disabled={saving || !canEdit}>
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Salvando
                    </>
                  ) : (
                    'Salvar dados da versão'
                  )}
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="rate_version_name" className="label">Nome da versão</label>
                <input
                  id="rate_version_name"
                  className="input"
                  value={versionName}
                  onChange={event => setVersionName(event.target.value)}
                  disabled={saving || !canEdit}
                />
              </div>
              <div>
                <label htmlFor="rate_assessment_date" className="label">Data</label>
                <input
                  id="rate_assessment_date"
                  type="date"
                  className="input"
                  value={assessmentDate}
                  onChange={event => setAssessmentDate(event.target.value)}
                  disabled={saving || !canEdit}
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="rate_version_notes" className="label">Notas da versão</label>
                <textarea
                  id="rate_version_notes"
                  className="input min-h-24"
                  value={versionNotes}
                  onChange={event => setVersionNotes(event.target.value)}
                  disabled={saving || !canEdit}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Table2 size={16} className="text-neutral-400" />
                <h2 className="text-base font-semibold text-neutral-900">Resultado por eixo</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-[0.16em] text-neutral-400">
                      <th className="px-3 py-3 font-medium">Eixo</th>
                      <th className="px-3 py-3 font-medium">Score</th>
                      <th className="px-3 py-3 font-medium">Conclusão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {axisScores.map(axis => (
                      <tr key={axis.axis} className="border-b border-neutral-100 last:border-b-0">
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedAxis(axis.axis)}
                            className={`text-left font-medium ${
                              selectedAxis === axis.axis ? 'text-brand-700' : 'text-neutral-800'
                            }`}
                          >
                            {axis.axis}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-neutral-700">
                          {formatRateScore(axis.score)} / 5,0
                        </td>
                        <td className="px-3 py-3 text-neutral-500">
                          {axis.completion >= 100
                            ? `Consolidado (${formatRateScore(axis.percent)}%)`
                            : `${axis.completion}% respondido`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Radar size={16} className="text-neutral-400" />
                <h2 className="text-base font-semibold text-neutral-900">
                  Detalhamento do eixo {selectedAxis ? `— ${selectedAxis}` : ''}
                </h2>
              </div>
              {selectedAxisItems.length === 0 ? (
                <p className="text-sm text-neutral-500">Selecione um eixo para detalhar os critérios avaliados.</p>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-500">
                          Resumo do eixo
                        </p>
                        <p className="mt-1 text-sm font-medium text-brand-900">
                          {selectedAxis} • Score {formatRateScore(selectedAxisScore?.score)} / 5,0
                        </p>
                      </div>
                      <p className="text-sm text-brand-800">
                        Rate geral atual: <span className="font-semibold">{formatRateScore(overallScore)} / 5,0</span>
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-neutral-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-neutral-50">
                        <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-[0.16em] text-neutral-400">
                          <th className="px-4 py-3 font-medium">Critério</th>
                          <th className="px-4 py-3 font-medium">Peso</th>
                          <th className="px-4 py-3 font-medium">Avaliação</th>
                          <th className="px-4 py-3 font-medium">Rate</th>
                          <th className="px-4 py-3 font-medium">Rate Geral</th>
                          <th className="px-4 py-3 font-medium">Rate Eixo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAxisItems.map(item => {
                          const draft = drafts[item.id] ?? { score: '', notes: '' }
                          const weighted = calculateWeightedScore(parseDraftScore(draft.score), Number(item.weight))
                          const scaleOptions = getRateScoreOptions(
                            selectedVersion.profile_type,
                            item.axis,
                            item.criterion
                          )
                          const criterionDescription =
                            getRateCriterionDefinition(selectedVersion.profile_type, item.axis, item.criterion)
                              ?.description ?? ''

                          return (
                            <tr key={item.id} className="border-b border-neutral-100 align-top last:border-b-0">
                              <td className="px-4 py-4">
                                <p className="font-medium text-neutral-900">{item.criterion}</p>
                                <p className="mt-1 text-xs text-neutral-500">{criterionDescription}</p>
                              </td>
                              <td className="px-4 py-4 font-medium text-neutral-700">
                                {formatRateWeight(Number(item.weight))}
                              </td>
                              <td className="px-4 py-4">
                                <div className="space-y-3">
                                  <select
                                    id={`rate_score_${item.id}`}
                                    className="input min-w-[20rem]"
                                    value={draft.score}
                                    onChange={event => updateItemDraft(item.id, 'score', event.target.value)}
                                    disabled={saving || !canEdit}
                                  >
                                    <option value="">Selecione</option>
                                    {scaleOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.shortLabel} - {option.description}
                                    </option>
                                  ))}
                                  </select>
                                  <p className="text-xs leading-5 text-neutral-500">
                                    {draft.score === ''
                                      ? 'Selecione uma nota oficial de 1 a 5 para este critério.'
                                      : getRateScoreDescription(
                                          selectedVersion.profile_type,
                                          item.axis,
                                          item.criterion,
                                          Number(draft.score)
                                        )}
                                  </p>
                                  <textarea
                                    id={`rate_notes_${item.id}`}
                                    className="input min-h-20"
                                    value={draft.notes}
                                    onChange={event => updateItemDraft(item.id, 'notes', event.target.value)}
                                    disabled={saving || !canEdit}
                                    placeholder="Observação opcional"
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-4 font-medium text-neutral-800">
                                {formatRateScore(weighted)}
                              </td>
                              <td className="px-4 py-4 text-neutral-700">
                                {formatRateScore(overallScore)} / 5,0
                              </td>
                              <td className="px-4 py-4 text-neutral-700">
                                {formatRateScore(selectedAxisScore?.score)} / 5,0
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end">
                    <button type="button" className="btn-primary" onClick={handleSaveAxis} disabled={saving || !canEdit}>
                      {saving ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Salvando eixo
                        </>
                      ) : (
                        'Salvar avaliação do eixo'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {orderedVersions.length > 1 && (
            <div className="space-y-5">
              <RateEvolutionChart versions={versionSeries} />

              <div className="card p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Scale size={16} className="text-neutral-400" />
                  <h2 className="text-base font-semibold text-neutral-900">Comparativo básico entre versões</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-[0.16em] text-neutral-400">
                        <th className="px-3 py-3 font-medium">Eixo</th>
                        {orderedVersions
                          .slice()
                          .sort((left, right) => left.version_number - right.version_number)
                          .map(version => (
                            <th key={version.id} className="px-3 py-3 font-medium">
                              v{version.version_number}
                            </th>
                        ))}
                        <th className="px-3 py-3 font-medium">Variação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map(row => (
                        <tr key={row.axis} className="border-b border-neutral-100 last:border-b-0">
                          <td className="px-3 py-3 font-medium text-neutral-800">{row.axis}</td>
                          {row.versionValues.map(({ version, score }) => (
                            <td key={version.id} className="px-3 py-3 text-neutral-700">
                              {formatRateScore(score)} / 5,0
                            </td>
                          ))}
                          <td className="px-3 py-3 text-neutral-700">
                            {row.variation === null ? '—' : `${row.variation > 0 ? '+' : ''}${formatRateScore(row.variation)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
