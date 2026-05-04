export interface DiaryMonthBucket {
  monthKey: string
  label: string
  visits: number
  deliverables: number
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: '2-digit',
})

const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatDiaryDate(value: string | null | undefined) {
  if (!value) return '-'
  const date = value.includes('T') ? new Date(value) : parseLocalDate(value)
  if (Number.isNaN(date.getTime())) return '-'
  return DATE_FORMATTER.format(date)
}

export function formatDiaryPeriod(startDate: string, endDate: string) {
  return `${formatDiaryDate(startDate)} a ${formatDiaryDate(endDate)}`
}

export function buildDiaryTitle(startDate: string, endDate: string) {
  if (!startDate || !endDate) return ''
  return `Visita de ${formatDiaryDate(startDate)} até ${formatDiaryDate(endDate)}`
}

export function getMonthKey(value: string) {
  const date = value.includes('T') ? new Date(value) : parseLocalDate(value)
  if (Number.isNaN(date.getTime())) return 'sem-data'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonthLabel(monthKey: string) {
  if (monthKey === 'sem-data') return 'Sem data'
  const [year, month] = monthKey.split('-').map(Number)
  return MONTH_FORMATTER.format(new Date(year, month - 1, 1)).replace('.', '')
}

export function buildDiaryMonthBuckets(
  entries: Array<{ start_date: string; deliverable_count: number }>
): DiaryMonthBucket[] {
  const buckets = new Map<string, DiaryMonthBucket>()

  entries.forEach(entry => {
    const monthKey = getMonthKey(entry.start_date)
    const current = buckets.get(monthKey) ?? {
      monthKey,
      label: formatMonthLabel(monthKey),
      visits: 0,
      deliverables: 0,
    }

    current.visits += 1
    current.deliverables += entry.deliverable_count
    buckets.set(monthKey, current)
  })

  return Array.from(buckets.values()).sort((left, right) => left.monthKey.localeCompare(right.monthKey))
}

export function isSameMonth(value: string, referenceDate = new Date()) {
  const monthKey = getMonthKey(value)
  const referenceKey = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}`
  return monthKey === referenceKey
}
