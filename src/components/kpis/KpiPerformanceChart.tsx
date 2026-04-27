import { cn, formatMeasurementValue } from '@/lib/utils'

interface ChartPoint {
  label: string
  target: number | null
  actual: number | null
}

interface KpiPerformanceChartProps {
  diagnosisValue: number | null
  diagnosisLabel: string
  diagnosisUnit?: string | null
  points: ChartPoint[]
  unit: string | null | undefined
}

const COLORS = {
  diagnosis: '#8aa5c7',
  target: '#144b91',
  actual: '#12b981',
  grid: '#dbe4f0',
  axis: '#97a5bb',
}

export function KpiPerformanceChart({
  diagnosisValue,
  diagnosisLabel,
  diagnosisUnit,
  points,
  unit,
}: KpiPerformanceChartProps) {
  const safePoints = points.filter(point => point.target !== null || point.actual !== null)
  const allValues = [
    ...(diagnosisValue !== null ? [diagnosisValue] : []),
    ...safePoints.flatMap(point => [point.target ?? 0, point.actual ?? 0]),
  ].filter(value => value !== null)

  if (allValues.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-200 px-5 py-8 text-sm text-neutral-500">
        Nenhuma série histórica disponível para o gráfico.
      </div>
    )
  }

  const maxValue = Math.max(...allValues, 1)
  const width = 920
  const height = 340
  const paddingLeft = 52
  const paddingRight = 28
  const paddingTop = 28
  const paddingBottom = 52
  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom
  const categories = [
    { label: diagnosisLabel, type: 'diagnosis' as const },
    ...safePoints.map(point => ({ label: point.label, type: 'period' as const })),
  ]
  const stepX = categories.length > 1 ? plotWidth / (categories.length - 1) : plotWidth

  function getY(value: number) {
    return paddingTop + plotHeight - (value / maxValue) * plotHeight
  }

  function getLabelY(value: number, counterpart: number | null, direction: 'up' | 'down') {
    const pointY = getY(value)

    if (counterpart === null) {
      return direction === 'up' ? pointY - 12 : pointY + 16
    }

    const counterpartY = getY(counterpart)
    const pointsAreClose = Math.abs(pointY - counterpartY) < 18

    if (direction === 'up') {
      return pointsAreClose ? pointY - 16 : pointY - 12
    }

    return pointsAreClose ? pointY + 20 : pointY + 16
  }

  const targetPolyline = safePoints
    .filter(point => point.target !== null)
    .map((point, index) => `${paddingLeft + stepX * (index + 1)},${getY(point.target as number)}`)
    .join(' ')

  const actualPolyline = safePoints
    .filter(point => point.actual !== null)
    .map((point, index) => `${paddingLeft + stepX * (index + 1)},${getY(point.actual as number)}`)
    .join(' ')

  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const value = (maxValue / 4) * index
    return {
      value,
      y: paddingTop + plotHeight - (plotHeight / 4) * index,
    }
  }).reverse()

  const diagnosisBarHeight = diagnosisValue === null ? 0 : (diagnosisValue / maxValue) * plotHeight

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {[
          ['Diagnóstico', COLORS.diagnosis],
          ['Meta', COLORS.target],
          ['Realizado', COLORS.actual],
        ].map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-2 text-xs font-medium text-neutral-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
      </div>

      <div className="rounded-[28px] border border-neutral-200 bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8fc_100%)] p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
          {gridLines.map(line => (
            <g key={line.value}>
              <line
                x1={paddingLeft}
                y1={line.y}
                x2={width - paddingRight}
                y2={line.y}
                stroke={COLORS.grid}
                strokeDasharray="4 6"
              />
              <text
                x={paddingLeft - 10}
                y={line.y + 4}
                textAnchor="end"
                fontSize="11"
                fill={COLORS.axis}
              >
                {formatMeasurementValue(line.value, unit)}
              </text>
            </g>
          ))}

          <line
            x1={paddingLeft}
            y1={paddingTop + plotHeight}
            x2={width - paddingRight}
            y2={paddingTop + plotHeight}
            stroke={COLORS.axis}
          />

          {diagnosisValue !== null && (
            <g>
              <rect
                x={paddingLeft - 18}
                y={paddingTop + plotHeight - diagnosisBarHeight}
                width="36"
                height={diagnosisBarHeight}
                rx="12"
                fill={COLORS.diagnosis}
                opacity="0.9"
              />
              <text
                x={paddingLeft}
                y={paddingTop + plotHeight - diagnosisBarHeight - 10}
                textAnchor="middle"
                fontSize="11"
                fill={COLORS.diagnosis}
              >
                {formatMeasurementValue(diagnosisValue, diagnosisUnit ?? unit)}
              </text>
            </g>
          )}

          {targetPolyline && (
            <polyline
              fill="none"
              stroke={COLORS.target}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={targetPolyline}
            />
          )}

          {actualPolyline && (
            <polyline
              fill="none"
              stroke={COLORS.actual}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={actualPolyline}
            />
          )}

          {safePoints.map((point, index) => {
            const x = paddingLeft + stepX * (index + 1)
            return (
              <g key={point.label}>
                {point.target !== null && (
                  <>
                    <circle cx={x} cy={getY(point.target)} r="4.5" fill={COLORS.target} />
                    <text
                      x={x}
                      y={getLabelY(point.target, point.actual, 'up')}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="600"
                      fill={COLORS.target}
                    >
                      {formatMeasurementValue(point.target, unit)}
                    </text>
                  </>
                )}
                {point.actual !== null && (
                  <>
                    <circle
                      cx={x}
                      cy={getY(point.actual)}
                      r="4.5"
                      fill={COLORS.actual}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text
                      x={x}
                      y={getLabelY(point.actual, point.target, 'down')}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="600"
                      fill={COLORS.actual}
                    >
                      {formatMeasurementValue(point.actual, unit)}
                    </text>
                  </>
                )}
              </g>
            )
          })}

          {categories.map((category, index) => {
            const x = paddingLeft + stepX * index
            return (
              <text
                key={category.label}
                x={x}
                y={height - 18}
                textAnchor="middle"
                fontSize="11"
                fill={COLORS.axis}
                className={cn(category.type === 'diagnosis' && 'font-semibold')}
              >
                {category.label}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
