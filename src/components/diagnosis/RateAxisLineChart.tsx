import { formatDate } from '@/lib/utils'
import { formatRateScore, type RateAxisCriterionSeries } from '@/lib/rate-faus'

interface RateAxisLineChartProps {
  series: RateAxisCriterionSeries
  compact?: boolean
}

const LINE_COLORS = ['#144b91', '#12b981', '#f59e0b', '#dc2626', '#7c3aed', '#0f766e']

function splitLabel(label: string, maxLength = 14) {
  if (label.length <= maxLength) return [label]

  const words = label.split(' ')
  const lines: string[] = []
  let current = ''

  words.forEach(word => {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxLength || !current) {
      current = next
    } else {
      lines.push(current)
      current = word
    }
  })

  if (current) lines.push(current)
  return lines.slice(0, 3)
}

export function RateAxisLineChart({ series, compact = false }: RateAxisLineChartProps) {
  const versionsWithData = series.versions.filter(version =>
    version.values.some(value => value.score !== null)
  )
  const criteria = series.criteria.length > 0
    ? series.criteria
    : series.versions[0]?.values.map(value => value.criterion) ?? []

  if (criteria.length === 0 || versionsWithData.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-neutral-200 bg-white px-5 py-10 text-sm text-neutral-500">
        Nenhuma avaliação disponível para este eixo.
      </div>
    )
  }

  const width = compact ? 720 : 920
  const height = compact ? 310 : 390
  const paddingLeft = 46
  const paddingRight = 28
  const paddingTop = 28
  const paddingBottom = compact ? 92 : 110
  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom
  const stepX = criteria.length > 1 ? plotWidth / (criteria.length - 1) : plotWidth

  function getY(score: number) {
    return paddingTop + plotHeight - (score / 5) * plotHeight
  }

  function getX(index: number) {
    return paddingLeft + stepX * index
  }

  return (
    <div className="rounded-[28px] border border-neutral-200 bg-white p-5">
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
            {series.axis}
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Critérios do eixo comparados entre todas as versões do Rate.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {versionsWithData.map((version, index) => (
            <span key={version.versionId} className="inline-flex items-center gap-2 text-[11px] font-medium text-neutral-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LINE_COLORS[index % LINE_COLORS.length] }} />
              v{version.versionNumber}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className={compact ? 'min-w-[38rem]' : 'min-w-[48rem]'}>
          {[5, 4, 3, 2, 1, 0].map(value => {
            const y = getY(value)
            const isReference = value === 3 || value === 5

            return (
              <g key={value}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke={value === 5 ? '#144b91' : value === 3 ? '#f59e0b' : '#e2e8f0'}
                  strokeDasharray={isReference ? '0' : '4 6'}
                  strokeWidth={isReference ? 1.4 : 1}
                  opacity={isReference ? 0.75 : 1}
                />
                <text x={paddingLeft - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                  {value}
                </text>
                {isReference && (
                  <text x={width - paddingRight - 4} y={y - 6} textAnchor="end" fontSize="10" fill={value === 5 ? '#144b91' : '#b45309'}>
                    {value === 5 ? 'máximo 5' : 'média 3'}
                  </text>
                )}
              </g>
            )
          })}

          {versionsWithData.map((version, versionIndex) => {
            const points = criteria
              .map((criterion, criterionIndex) => {
                const score = version.values.find(value => value.criterion === criterion)?.score
                if (score === null || score === undefined) return null
                return {
                  criterion,
                  score,
                  x: getX(criterionIndex),
                  y: getY(score),
                }
              })
              .filter((point): point is { criterion: string; score: number; x: number; y: number } => point !== null)
            const color = LINE_COLORS[versionIndex % LINE_COLORS.length]
            const polyline = points.map(point => `${point.x},${point.y}`).join(' ')

            return (
              <g key={version.versionId}>
                {polyline && (
                  <polyline
                    points={polyline}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {points.map(point => (
                  <g key={`${version.versionId}-${point.criterion}`}>
                    <circle cx={point.x} cy={point.y} r="4.5" fill={color} stroke="#ffffff" strokeWidth="1.5" />
                    {!compact && (
                      <text x={point.x} y={point.y - 10} textAnchor="middle" fontSize="10" fontWeight="600" fill={color}>
                        {formatRateScore(point.score)}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            )
          })}

          {criteria.map((criterion, index) => {
            const x = getX(index)
            const labelLines = splitLabel(criterion, compact ? 12 : 15)

            return (
              <g key={criterion}>
                <line x1={x} y1={paddingTop} x2={x} y2={paddingTop + plotHeight} stroke="#f1f5f9" />
                <text x={x} y={height - paddingBottom + 32} textAnchor="middle" fontSize={compact ? '10' : '11'} fill="#64748b" fontWeight="600">
                  {labelLines.map((line, lineIndex) => (
                    <tspan key={`${criterion}-${line}`} x={x} dy={lineIndex === 0 ? 0 : compact ? 11 : 13}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-neutral-500">
        {versionsWithData.map((version, index) => (
          <span key={version.versionId} className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LINE_COLORS[index % LINE_COLORS.length] }} />
            v{version.versionNumber} · {version.versionName} · {formatDate(version.assessmentDate)}
          </span>
        ))}
      </div>
    </div>
  )
}
