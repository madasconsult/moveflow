import { formatRateScore, type RateAxisScore } from '@/lib/rate-faus'

interface RateRadarChartProps {
  axes: RateAxisScore[]
  compact?: boolean
}

export function RateRadarChart({ axes, compact = false }: RateRadarChartProps) {
  if (axes.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-neutral-200 bg-white px-5 py-10 text-sm text-neutral-500">
        Nenhum eixo disponível para exibir o radar.
      </div>
    )
  }

  const size = compact ? 420 : 520
  const center = size / 2
  const radius = compact ? 108 : 138
  const levels = 5
  const labelRadius = radius + (compact ? 54 : 72)

  function getAxisLabelLines(label: string) {
    const maxLineLength = compact ? 14 : 18
    if (label.length <= maxLineLength) return [label]

    const words = label.split(' ')
    const lines: string[] = []
    let current = ''

    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (next.length <= maxLineLength || current === '') {
        current = next
      } else {
        lines.push(current)
        current = word
      }
    }

    if (current) lines.push(current)
    return lines
  }

  const axisPoints = axes.map((axis, index) => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2
    const x = center + Math.cos(angle) * radius
    const y = center + Math.sin(angle) * radius
    const valueRadius = ((axis.score ?? 0) / 5) * radius

    return {
      ...axis,
      labelLines: getAxisLabelLines(axis.axis),
      labelX: center + Math.cos(angle) * labelRadius,
      labelY: center + Math.sin(angle) * labelRadius,
      x,
      y,
      valueX: center + Math.cos(angle) * valueRadius,
      valueY: center + Math.sin(angle) * valueRadius,
    }
  })

  const polygon = axisPoints.map(point => `${point.valueX},${point.valueY}`).join(' ')

  return (
    <div className="rounded-[28px] border border-neutral-200 bg-white p-5">
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
          Radar por eixo
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Leitura visual do posicionamento da versão atual em cada eixo do Rate.
        </p>
      </div>

      <div className="flex justify-center overflow-x-auto">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className={compact ? 'h-[22rem] w-full max-w-[24rem]' : 'h-[30rem] w-full max-w-[32rem]'}
        >
          {Array.from({ length: levels }, (_, index) => {
            const levelRadius = radius * ((index + 1) / levels)
            const points = axisPoints
              .map(point => {
                const angle = Math.atan2(point.y - center, point.x - center)
                const x = center + Math.cos(angle) * levelRadius
                const y = center + Math.sin(angle) * levelRadius
                return `${x},${y}`
              })
              .join(' ')

            return (
              <polygon
                key={levelRadius}
                points={points}
                fill="none"
                stroke="#d8e2ee"
                strokeWidth="1"
              />
            )
          })}

          {axisPoints.map(point => (
            <g key={point.axis}>
              <line x1={center} y1={center} x2={point.x} y2={point.y} stroke="#d8e2ee" strokeWidth="1" />
              <text
                x={point.labelX}
                y={point.labelY}
                textAnchor={point.labelX >= center ? 'start' : 'end'}
                fontSize={compact ? '10' : '11'}
                fontWeight="600"
                fill="#334155"
              >
                {point.labelLines.map((line, index) => (
                  <tspan
                    key={`${point.axis}-${line}-${index}`}
                    x={point.labelX}
                    dy={index === 0 ? 0 : compact ? 12 : 13}
                  >
                    {line}
                  </tspan>
                ))}
              </text>
              <text
                x={point.labelX}
                y={point.labelY + (point.labelLines.length > 1 ? (compact ? 23 : 27) : compact ? 13 : 15)}
                textAnchor={point.labelX >= center ? 'start' : 'end'}
                fontSize={compact ? '9' : '10'}
                fill="#64748b"
              >
                {formatRateScore(point.score)}
              </text>
            </g>
          ))}

          <polygon
            points={polygon}
            fill="rgba(20, 75, 145, 0.18)"
            stroke="#144b91"
            strokeWidth="2.5"
          />

          {axisPoints.map(point => (
            <circle key={point.axis} cx={point.valueX} cy={point.valueY} r="4.5" fill="#144b91" />
          ))}
        </svg>
      </div>
    </div>
  )
}
