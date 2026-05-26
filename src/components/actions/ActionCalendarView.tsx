import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, ACTION_STATUS_COLORS, ACTION_STATUS_LABELS } from '@/lib/utils'
import { isActionOverdue } from '@/lib/action-pipeline'
import type { ActionPriority, ActionStatus } from '@/types/database.types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CalendarAction = {
  id: string
  title: string
  due_date: string | null
  status: ActionStatus
  priority: ActionPriority
  assigned_to: string | null
  completion_date: string | null
}

interface ActionCalendarViewProps {
  actions: CalendarAction[]
  responsibleMap: Map<string, string>
  year: number
  month: number      // 1-indexed (Janeiro = 1)
  filterBase: string // query string de filtros sem view/month (ex: "status=in_progress&due=overdue")
  returnTo: string   // já encodado com encodeURIComponent para usar em action links
}

// ── Constantes ────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// ── Helpers de data ───────────────────────────────────────────────────────────

/** Retorna a segunda-feira da semana que contém a data informada */
function startOfMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay() // 0=dom, 1=seg ... 6=sab
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

/** Formata Date como YYYY-MM-DD (sem fuso horário) */
function toYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function monthParamStr(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function prevMonthOf(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

function nextMonthOf(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

/** Constrói o array de dias que preenche o grid do mês (seg→dom, semanas completas) */
function buildCalendarGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0) // dia 0 do próximo mês = último dia do mês atual
  const gridStart = startOfMonday(firstDay)
  const days: Date[] = []
  let cur = gridStart
  while (true) {
    days.push(new Date(cur))
    if (cur >= lastDay && days.length % 7 === 0) break
    cur = addDays(cur, 1)
  }
  return days
}

// ── Componente principal ──────────────────────────────────────────────────────

export function ActionCalendarView({
  actions,
  responsibleMap,
  year,
  month,
  filterBase,
  returnTo,
}: ActionCalendarViewProps) {
  const today = new Date()
  const todayStr = toYMD(today)

  // Agrupa ações por due_date
  const actionsByDate = new Map<string, CalendarAction[]>()
  const noDateActions: CalendarAction[] = []

  for (const action of actions) {
    if (!action.due_date) {
      noDateActions.push(action)
    } else {
      const key = action.due_date.slice(0, 10)
      const existing = actionsByDate.get(key) ?? []
      actionsByDate.set(key, [...existing, action])
    }
  }

  // Grid de dias
  const gridDays = buildCalendarGrid(year, month)
  const weeks: Date[][] = []
  for (let i = 0; i < gridDays.length; i += 7) {
    weeks.push(gridDays.slice(i, i + 7))
  }

  // URLs de navegação entre meses
  const prev = prevMonthOf(year, month)
  const next = nextMonthOf(year, month)
  const qs = filterBase ? `&${filterBase}` : ''
  const prevUrl = `/dashboard/acoes?view=calendar&month=${monthParamStr(prev.year, prev.month)}${qs}`
  const nextUrl = `/dashboard/acoes?view=calendar&month=${monthParamStr(next.year, next.month)}${qs}`

  const MAX_VISIBLE = 3

  return (
    <div className="space-y-4">
      {/* Card do calendário */}
      <div className="card overflow-hidden p-0">

        {/* Navegação de mês */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <Link href={prevUrl} className="btn-ghost p-1.5" aria-label="Mês anterior">
            <ChevronLeft size={16} />
          </Link>
          <span className="text-sm font-semibold text-neutral-900">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Link href={nextUrl} className="btn-ghost p-1.5" aria-label="Próximo mês">
            <ChevronRight size={16} />
          </Link>
        </div>

        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 border-b border-neutral-100 bg-neutral-50">
          {WEEKDAY_LABELS.map(label => (
            <div
              key={label}
              className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-400"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Grid dos dias */}
        <div className="grid grid-cols-7 divide-x divide-y divide-neutral-100">
          {weeks.flat().map((day, idx) => {
            const dateStr = toYMD(day)
            const isCurrentMonth = day.getMonth() === month - 1
            const isToday = dateStr === todayStr
            const dayActions = actionsByDate.get(dateStr) ?? []

            return (
              <div
                key={idx}
                className={cn(
                  'min-h-[100px] p-2',
                  !isCurrentMonth && 'bg-neutral-50/70',
                  isToday && 'bg-brand-50',
                )}
              >
                {/* Número do dia */}
                <div
                  className={cn(
                    'mb-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium',
                    isToday
                      ? 'bg-brand-600 text-white'
                      : isCurrentMonth
                        ? 'text-neutral-600'
                        : 'text-neutral-300',
                  )}
                >
                  {day.getDate()}
                </div>

                {/* Cards de ações */}
                <div className="space-y-0.5">
                  {dayActions.slice(0, MAX_VISIBLE).map(action => {
                    const overdue = isActionOverdue(action)
                    return (
                      <Link
                        key={action.id}
                        href={`/dashboard/acoes/${action.id}?returnTo=${returnTo}`}
                        className={cn(
                          'block truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-snug transition hover:opacity-75',
                          overdue
                            ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-100'
                            : action.status === 'completed'
                              ? 'bg-green-50 text-green-700'
                              : action.status === 'cancelled'
                                ? 'bg-neutral-100 text-neutral-400 line-through'
                                : 'bg-brand-50 text-brand-700',
                        )}
                        title={`${action.title} — ${ACTION_STATUS_LABELS[action.status]}`}
                      >
                        {action.title}
                      </Link>
                    )
                  })}
                  {dayActions.length > MAX_VISIBLE && (
                    <p className="px-1 text-[10px] text-neutral-400">
                      +{dayActions.length - MAX_VISIBLE} mais
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Ações sem prazo */}
      {noDateActions.length > 0 && (
        <div className="card p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Sem prazo ({noDateActions.length})
          </p>
          <div className="space-y-2">
            {noDateActions.map(action => (
              <Link
                key={action.id}
                href={`/dashboard/acoes/${action.id}?returnTo=${returnTo}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 transition hover:border-brand-200 hover:shadow-sm"
              >
                <span className="min-w-0 truncate text-sm font-medium text-neutral-900">
                  {action.title}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {action.assigned_to && responsibleMap.get(action.assigned_to) && (
                    <span className="text-xs text-neutral-400">
                      {responsibleMap.get(action.assigned_to)}
                    </span>
                  )}
                  <span className={cn('badge', ACTION_STATUS_COLORS[action.status])}>
                    {ACTION_STATUS_LABELS[action.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {actions.length === 0 && (
        <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-sm text-neutral-500">
            Nenhuma ação encontrada para o período e filtros selecionados.
          </p>
        </div>
      )}
    </div>
  )
}
