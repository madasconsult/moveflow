import type { DiaryMonthBucket } from '@/lib/diary-board'

interface DiaryMonthlyChartProps {
  data: DiaryMonthBucket[]
  metric: 'visits' | 'deliverables'
  title: string
  emptyLabel: string
}

export function DiaryMonthlyChart({
  data,
  metric,
  title,
  emptyLabel,
}: DiaryMonthlyChartProps) {
  const maxValue = Math.max(...data.map(item => item[metric]), 0)

  return (
    <div className="card p-6">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Evolução mensal dentro do projeto ativo.
        </p>
      </div>

      {data.length === 0 ? (
        <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 text-sm text-neutral-500">
          {emptyLabel}
        </div>
      ) : (
        <div className="flex h-56 items-end gap-3 overflow-x-auto pb-2">
          {data.map(item => {
            const value = item[metric]
            const height = maxValue > 0 ? Math.max((value / maxValue) * 160, value > 0 ? 18 : 6) : 6

            return (
              <div key={item.monthKey} className="flex min-w-16 flex-1 flex-col items-center gap-2">
                <span className="text-xs font-semibold text-neutral-700">{value}</span>
                <div
                  className="w-full rounded-t-2xl bg-gradient-to-t from-brand-700 to-brand-400 shadow-sm"
                  style={{ height }}
                  aria-label={`${item.label}: ${value}`}
                />
                <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                  {item.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
