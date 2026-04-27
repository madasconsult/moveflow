import { formatDate } from '@/lib/utils'
import { formatRateScore, type RateVersionSeriesPoint } from '@/lib/rate-faus'

interface RateEvolutionChartProps {
  versions: RateVersionSeriesPoint[]
}

export function RateEvolutionChart({ versions }: RateEvolutionChartProps) {
  const safeVersions = versions.filter(version => version.overallScore !== null)

  if (safeVersions.length < 2) {
    return (
      <div className="rounded-[28px] border border-dashed border-neutral-200 bg-white px-5 py-10 text-sm text-neutral-500">
        O comparativo de evolução fica disponível a partir da segunda versão do Rate.
      </div>
    )
  }

  const width = 760
  const height = 240
  const paddingLeft = 48
  const paddingRight = 24
  const paddingTop = 22
  const paddingBottom = 44
  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom
  const stepX = safeVersions.length > 1 ? plotWidth / (safeVersions.length - 1) : plotWidth

  const points = safeVersions.map((version, index) => {
    const score = version.overallScore ?? 0
    const x = paddingLeft + stepX * index
    const y = paddingTop + plotHeight - (score / 5) * plotHeight
    return { ...version, x, y }
  })

  const polyline = points.map(point => `${point.x},${point.y}`).join(' ')

  return (
    <div className="rounded-[28px] border border-neutral-200 bg-white p-5">
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
          Evolução do Rate geral
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Comparativo simples da maturidade global ao longo das versões já registradas.
        </p>
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[42rem]">
          {Array.from({ length: 6 }, (_, index) => {
            const value = 5 - index
            const y = paddingTop + (plotHeight / 5) * index

            return (
              <g key={value}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 6"
                />
                <text x={paddingLeft - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                  {value.toFixed(1)}
                </text>
              </g>
            )
          })}

          <polyline
            points={polyline}
            fill="none"
            stroke="#144b91"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map(point => (
            <g key={point.versionId}>
              <circle cx={point.x} cy={point.y} r="5" fill="#144b91" />
              <text x={point.x} y={point.y - 12} textAnchor="middle" fontSize="11" fontWeight="600" fill="#144b91">
                {formatRateScore(point.overallScore)}
              </text>
              <text x={point.x} y={height - 20} textAnchor="middle" fontSize="11" fill="#64748b">
                {point.versionName}
              </text>
              <text x={point.x} y={height - 7} textAnchor="middle" fontSize="10" fill="#94a3b8">
                {formatDate(point.assessmentDate)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
