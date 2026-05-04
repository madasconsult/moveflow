import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { cn, formatMeasurementValue } from '@/lib/utils'

interface KpiExecutivePoint {
  label: string
  target: number | null
  actual: number | null
}

interface ProjectKpiExecutiveCardProps {
  href: string
  name: string
  originLabel: string
  statusLabel: string
  statusClassName: string
  referenceValue: number | null
  referenceUnit: string | null | undefined
  unit: string | null | undefined
  points: KpiExecutivePoint[]
}

export function ProjectKpiExecutiveCard({
  href,
  name,
  originLabel,
  statusLabel,
  statusClassName,
  referenceValue,
  referenceUnit,
  unit,
  points,
}: ProjectKpiExecutiveCardProps) {
  const safePoints = points.filter(point => point.target !== null || point.actual !== null)
  const values = [
    referenceValue,
    ...safePoints.flatMap(point => [point.target, point.actual]),
  ].filter((value): value is number => value !== null && value !== undefined)
  const maxValue = Math.max(...values, 1)
  const width = 520
  const height = 210
  const paddingLeft = 44
  const paddingRight = 22
  const paddingTop = 22
  const paddingBottom = 44
  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom
  const diagnosisSlotWidth = referenceValue !== null ? 62 : 0
  const seriesStartX = paddingLeft + diagnosisSlotWidth
  const seriesPlotWidth = plotWidth - diagnosisSlotWidth
  const stepX = safePoints.length > 1 ? seriesPlotWidth / (safePoints.length - 1) : seriesPlotWidth
  const diagnosisBarWidth = 34

  function getY(value: number) {
    return paddingTop + plotHeight - (value / maxValue) * plotHeight
  }

  function getDataLabelY(value: number, counterpart: number | null, direction: 'up' | 'down') {
    const pointY = getY(value)

    if (counterpart === null) {
      return direction === 'up' ? pointY - 8 : pointY + 15
    }

    const pointsAreClose = Math.abs(pointY - getY(counterpart)) < 18

    if (direction === 'up') {
      return pointsAreClose ? pointY - 15 : pointY - 8
    }

    return pointsAreClose ? pointY + 22 : pointY + 15
  }

  const targetPolyline = safePoints
    .map((point, index) => point.target === null ? null : `${seriesStartX + stepX * index},${getY(point.target)}`)
    .filter(Boolean)
    .join(' ')
  const actualPolyline = safePoints
    .map((point, index) => point.actual === null ? null : `${seriesStartX + stepX * index},${getY(point.actual)}`)
    .filter(Boolean)
    .join(' ')

  return (
    <Link
      href={href}
      className="group card block overflow-hidden border border-neutral-200 p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">{originLabel}</p>
          <h3 className="mt-2 text-base font-semibold leading-tight text-neutral-900 group-hover:text-brand-700">
            {name}
          </h3>
        </div>
        <ArrowUpRight size={18} className="shrink-0 text-neutral-300 transition group-hover:text-brand-600" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className={cn('badge', statusClassName)}>{statusLabel}</span>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
          Ref. {formatMeasurementValue(referenceValue, referenceUnit ?? unit)}
        </span>
      </div>

      {safePoints.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
          Sem metas ou apurações no período selecionado.
        </div>
      ) : (
        <div className="mt-5 rounded-[24px] border border-neutral-100 bg-[linear-gradient(180deg,#fbfdff_0%,#f5f8fc_100%)] p-3">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
            {[0, 1, 2, 3].map(index => {
              const y = paddingTop + (plotHeight / 3) * index
              return (
                <line
                  key={index}
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 6"
                />
              )
            })}

            {targetPolyline && (
              <polyline points={targetPolyline} fill="none" stroke="#144b91" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {actualPolyline && (
              <polyline points={actualPolyline} fill="none" stroke="#12b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {referenceValue !== null && (
              <g>
                <rect
                  x={paddingLeft - diagnosisBarWidth / 2}
                  y={getY(referenceValue)}
                  width={diagnosisBarWidth}
                  height={paddingTop + plotHeight - getY(referenceValue)}
                  rx="10"
                  fill="#8aa5c7"
                  opacity="0.9"
                />
                <text
                  x={paddingLeft}
                  y={getY(referenceValue) - 8}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="#6f8fb5"
                >
                  {formatMeasurementValue(referenceValue, referenceUnit ?? unit)}
                </text>
                <text x={paddingLeft} y={height - 18} textAnchor="middle" fontSize="10" fill="#64748b">
                  Diagn.
                </text>
              </g>
            )}

            {safePoints.map((point, index) => {
              const x = seriesStartX + stepX * index
              return (
                <g key={point.label}>
                  {point.target !== null && (
                    <>
                      <circle cx={x} cy={getY(point.target)} r="4" fill="#144b91" />
                      <text
                        x={x}
                        y={getDataLabelY(point.target, point.actual, 'up')}
                        textAnchor="middle"
                        fontSize="8.5"
                        fontWeight="700"
                        fill="#144b91"
                      >
                        {formatMeasurementValue(point.target, unit)}
                      </text>
                    </>
                  )}
                  {point.actual !== null && (
                    <>
                      <circle cx={x} cy={getY(point.actual)} r="4" fill="#12b981" stroke="#ffffff" strokeWidth="1.5" />
                      <text
                        x={x}
                        y={getDataLabelY(point.actual, point.target, 'down')}
                        textAnchor="middle"
                        fontSize="8.5"
                        fontWeight="700"
                        fill="#0f9f72"
                      >
                        {formatMeasurementValue(point.actual, unit)}
                      </text>
                    </>
                  )}
                  <text x={x} y={height - 18} textAnchor="middle" fontSize="10" fill="#64748b">
                    {point.label}
                  </text>
                </g>
              )
            })}
          </svg>
          <div className="mt-2 flex items-center gap-4 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-3 rounded-sm bg-[#8aa5c7]" />
              Diagnóstico
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#144b91]" />
              Meta
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#12b981]" />
              Realizado
            </span>
          </div>
        </div>
      )}
    </Link>
  )
}
