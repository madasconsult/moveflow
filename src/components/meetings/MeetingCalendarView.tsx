import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MEETING_TYPE_LABELS, cn, formatDate, formatDateTime } from '@/lib/utils'
import type { Meeting } from '@/types/database.types'

type MeetingCard = Pick<Meeting, 'id' | 'meeting_date' | 'meeting_type' | 'project_id'>

interface ProjectMapEntry {
  id: string
  project_name: string
}

interface MeetingCalendarViewProps {
  meetings: MeetingCard[]
  projectMap: Map<string, string>
  view: 'month' | 'week' | 'day'
  baseDate: Date
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function startOfWeek(date: Date) {
  const next = startOfDay(date)
  const day = next.getDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setDate(next.getDate() + diff)
  return next
}

function endOfWeek(date: Date) {
  const next = startOfWeek(date)
  next.setDate(next.getDate() + 6)
  next.setHours(23, 59, 59, 999)
  return next
}

function startOfMonthGrid(date: Date) {
  const next = new Date(date.getFullYear(), date.getMonth(), 1)
  return startOfWeek(next)
}

function endOfMonthGrid(date: Date) {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const end = endOfWeek(next)
  return end
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function MeetingCalendarView({
  meetings,
  projectMap,
  view,
  baseDate,
}: MeetingCalendarViewProps) {
  const base = startOfDay(baseDate)
  const dayMeetings = meetings
    .filter(meeting => isSameDay(new Date(meeting.meeting_date), base))
    .sort((left, right) => left.meeting_date.localeCompare(right.meeting_date))

  const weekStart = startOfWeek(base)
  const weekEnd = endOfWeek(base)
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

  const monthStart = startOfMonthGrid(base)
  const monthEnd = endOfMonthGrid(base)
  const monthDays: Date[] = []
  let cursor = new Date(monthStart)
  while (cursor <= monthEnd) {
    monthDays.push(new Date(cursor))
    cursor = addDays(cursor, 1)
  }

  const previousHref =
    view === 'month'
      ? `/dashboard/reunioes?view=calendar&period=month&date=${new Date(base.getFullYear(), base.getMonth() - 1, 1).toISOString().slice(0, 10)}`
      : view === 'week'
        ? `/dashboard/reunioes?view=calendar&period=week&date=${addDays(base, -7).toISOString().slice(0, 10)}`
        : `/dashboard/reunioes?view=calendar&period=day&date=${addDays(base, -1).toISOString().slice(0, 10)}`

  const nextHref =
    view === 'month'
      ? `/dashboard/reunioes?view=calendar&period=month&date=${new Date(base.getFullYear(), base.getMonth() + 1, 1).toISOString().slice(0, 10)}`
      : view === 'week'
        ? `/dashboard/reunioes?view=calendar&period=week&date=${addDays(base, 7).toISOString().slice(0, 10)}`
        : `/dashboard/reunioes?view=calendar&period=day&date=${addDays(base, 1).toISOString().slice(0, 10)}`

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            {view === 'month'
              ? base.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
              : view === 'week'
                ? `${formatDate(weekStart.toISOString())} até ${formatDate(weekEnd.toISOString())}`
                : formatDate(base.toISOString())}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            {view === 'month' ? 'Visão mensal' : view === 'week' ? 'Visão semanal' : 'Visão diária'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={previousHref} className="btn-secondary">
            <ChevronLeft size={16} />
          </Link>
          <Link href={nextHref} className="btn-secondary">
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      {view === 'day' ? (
        <div className="p-5">
          {dayMeetings.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhuma reunião programada para este dia.</p>
          ) : (
            <div className="space-y-3">
              {dayMeetings.map(meeting => (
                <Link
                  key={meeting.id}
                  href={`/dashboard/reunioes/${meeting.id}`}
                  className="block rounded-2xl border border-neutral-200 p-4 transition hover:bg-neutral-50"
                >
                  <p className="text-sm font-semibold text-neutral-900">
                    {MEETING_TYPE_LABELS[meeting.meeting_type]}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">{projectMap.get(meeting.project_id) ?? 'Projeto vinculado'}</p>
                  <p className="mt-2 text-sm text-neutral-600">{formatDateTime(meeting.meeting_date)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : view === 'week' ? (
        <div className="grid gap-px bg-neutral-200 md:grid-cols-7">
          {weekDays.map(day => {
            const items = meetings
              .filter(meeting => isSameDay(new Date(meeting.meeting_date), day))
              .sort((left, right) => left.meeting_date.localeCompare(right.meeting_date))

            return (
              <div key={day.toISOString()} className="min-h-52 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                  {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
                </p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">
                  {day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </p>
                <div className="mt-3 space-y-2">
                  {items.map(meeting => (
                    <Link
                      key={meeting.id}
                      href={`/dashboard/reunioes/${meeting.id}`}
                      className="block rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800 transition hover:bg-blue-100"
                    >
                      <p className="font-semibold">{MEETING_TYPE_LABELS[meeting.meeting_type]}</p>
                      <p className="mt-1">{new Date(meeting.meeting_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="grid gap-px bg-neutral-200 md:grid-cols-7">
          {monthDays.map(day => {
            const items = meetings
              .filter(meeting => isSameDay(new Date(meeting.meeting_date), day))
              .sort((left, right) => left.meeting_date.localeCompare(right.meeting_date))

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-44 bg-white p-3',
                  day.getMonth() !== base.getMonth() && 'bg-neutral-50'
                )}
              >
                <p className="text-sm font-semibold text-neutral-900">{day.getDate()}</p>
                <div className="mt-3 space-y-2">
                  {items.map(meeting => (
                    <Link
                      key={meeting.id}
                      href={`/dashboard/reunioes/${meeting.id}`}
                      className="block rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800 transition hover:bg-blue-100"
                    >
                      <p className="font-semibold">{MEETING_TYPE_LABELS[meeting.meeting_type]}</p>
                      <p className="mt-1 truncate">{projectMap.get(meeting.project_id) ?? 'Projeto'}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
