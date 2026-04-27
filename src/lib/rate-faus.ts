import { RATE_CRITERION_LIBRARY, RATE_PROFILE_WEIGHTS } from '@/lib/rate-faus-matrix'
import type {
  InsertDto,
  RateAssessmentItem,
  RateAssessmentVersion,
  RateProfileType,
} from '@/types/database.types'

type RateScoreValue = 1 | 2 | 3 | 4 | 5

interface RateCriterionScale {
  1: string
  2: string
  3: string
  4: string
  5: string
}

export interface RateCriterionTemplate {
  criterion: string
  description: string
  weight: number
  scale: RateCriterionScale
}

export interface RateAxisTemplate {
  axis: string
  criteria: RateCriterionTemplate[]
}

export interface RateAxisScore {
  axis: string
  score: number | null
  percent: number | null
  totalWeight: number
  completion: number
}

export interface RateVersionSeriesPoint {
  versionId: string
  versionNumber: number
  versionName: string
  assessmentDate: string
  overallScore: number | null
}

export interface RateScoreOption {
  value: RateScoreValue
  shortLabel: string
  description: string
}

export const RATE_PROFILE_LABELS: Record<RateProfileType, string> = {
  distribuidor: 'Distribuidor',
  industria: 'Indústria',
  operador_logistico: 'Operador Logístico',
}

export const RATE_SCORE_VALUES: RateScoreValue[] = [1, 2, 3, 4, 5]

const CRITERION_LIBRARY = RATE_CRITERION_LIBRARY as readonly {
  axis: string
  criteria: readonly {
    criterion: string
    description: string
    scale: RateCriterionScale
  }[]
}[]

const PROFILE_WEIGHTS = RATE_PROFILE_WEIGHTS as Record<
  RateProfileType,
  Record<string, Record<string, number>>
>

function normalizeScaleDescription(description: string) {
  return description.replace(/^\s*\d+\s*-\s*/, '').trim()
}

export function getRateProfileTemplate(profileType: RateProfileType): RateAxisTemplate[] {
  const weights = PROFILE_WEIGHTS[profileType]

  return CRITERION_LIBRARY.map(axis => ({
    axis: axis.axis,
    criteria: axis.criteria.map(criterion => ({
      criterion: criterion.criterion,
      description: criterion.description,
      weight: weights[axis.axis]?.[criterion.criterion] ?? 0,
      scale: criterion.scale,
    })),
  }))
}

export function getRateCriterionDefinition(
  profileType: RateProfileType,
  axis: string,
  criterion: string
) {
  const profile = getRateProfileTemplate(profileType)
  const axisDefinition = profile.find(entry => entry.axis === axis)
  return axisDefinition?.criteria.find(entry => entry.criterion === criterion) ?? null
}

export function getRateScoreDescription(
  profileType: RateProfileType,
  axis: string,
  criterion: string,
  score: number | null | undefined
) {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return 'Sem avaliação registrada'
  }

  const definition = getRateCriterionDefinition(profileType, axis, criterion)
  if (!definition) return 'Sem avaliação registrada'

  return (
    normalizeScaleDescription(definition.scale[Math.round(score) as RateScoreValue] ?? '') ||
    'Sem avaliação registrada'
  )
}

export function getRateScoreOptions(
  profileType: RateProfileType,
  axis: string,
  criterion: string
): RateScoreOption[] {
  const definition = getRateCriterionDefinition(profileType, axis, criterion)
  if (!definition) return []

  return RATE_SCORE_VALUES.map(value => ({
    value,
    shortLabel: value.toString(),
    description: normalizeScaleDescription(definition.scale[value]),
  }))
}

export function createRateItemsForVersion(
  versionId: string,
  profileType: RateProfileType
): InsertDto<'rate_assessment_items'>[] {
  return getRateProfileTemplate(profileType).flatMap(axis =>
    axis.criteria.map(criterion => ({
      version_id: versionId,
      axis: axis.axis,
      criterion: criterion.criterion,
      weight: criterion.weight,
      score: null,
      weighted_score: null,
      notes: null,
    }))
  )
}

export function calculateWeightedScore(score: number | null, weight: number) {
  if (score === null || Number.isNaN(score)) return null
  return Number((score * weight).toFixed(4))
}

export function calculateRateOverallScore(items: Pick<RateAssessmentItem, 'weight' | 'score'>[]) {
  const scoredItems = items.filter(item => item.score !== null)
  if (scoredItems.length === 0) return null

  const totalWeight = scoredItems.reduce((sum, item) => sum + Number(item.weight), 0)
  if (totalWeight === 0) return null

  const weightedTotal = scoredItems.reduce(
    (sum, item) => sum + Number(item.score ?? 0) * Number(item.weight),
    0
  )

  return Number((weightedTotal / totalWeight).toFixed(2))
}

export function calculateRateAxisScores(
  items: Pick<RateAssessmentItem, 'axis' | 'weight' | 'score'>[]
): RateAxisScore[] {
  const grouped = new Map<string, Pick<RateAssessmentItem, 'axis' | 'weight' | 'score'>[]>()

  for (const item of items) {
    const current = grouped.get(item.axis) ?? []
    current.push(item)
    grouped.set(item.axis, current)
  }

  return Array.from(grouped.entries()).map(([axis, axisItems]) => {
    const scoredItems = axisItems.filter(item => item.score !== null)
    const totalWeight = axisItems.reduce((sum, item) => sum + Number(item.weight), 0)
    const scoredWeight = scoredItems.reduce((sum, item) => sum + Number(item.weight), 0)
    const weightedTotal = scoredItems.reduce(
      (sum, item) => sum + Number(item.score ?? 0) * Number(item.weight),
      0
    )
    const score = scoredWeight === 0 ? null : Number((weightedTotal / scoredWeight).toFixed(2))

    return {
      axis,
      score,
      percent: score === null ? null : Number(((score / 5) * 100).toFixed(1)),
      totalWeight,
      completion: totalWeight === 0 ? 0 : Number(((scoredWeight / totalWeight) * 100).toFixed(1)),
    }
  })
}

export function formatRateScore(score: number | null | undefined) {
  if (score === null || score === undefined || Number.isNaN(score)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(score)
}

export function formatRateWeight(weight: number | null | undefined) {
  if (weight === null || weight === undefined || Number.isNaN(weight)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(weight)
}

export function buildRateVersionSeries(
  versions: Pick<
    RateAssessmentVersion,
    'id' | 'version_number' | 'version_name' | 'assessment_date' | 'overall_score'
  >[]
): RateVersionSeriesPoint[] {
  return [...versions]
    .sort((a, b) => a.version_number - b.version_number)
    .map(version => ({
      versionId: version.id,
      versionNumber: version.version_number,
      versionName: version.version_name,
      assessmentDate: version.assessment_date,
      overallScore: version.overall_score,
    }))
}
