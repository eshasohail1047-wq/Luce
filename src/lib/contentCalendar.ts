export type CalendarChannel = 'ig' | 'tt' | 'fb' | 'pin' | 'meta' | 'other'

export type CalendarStatus = 'planned' | 'ready' | 'posted'

export type CalendarItem = {
  id: string
  title: string
  channel: CalendarChannel
  date: string // YYYY-MM-DD
  time: string // HH:mm
  status: CalendarStatus
  note?: string
  imageUrl?: string
}

const CHANNEL_LABELS: Record<CalendarChannel, string> = {
  ig: 'Instagram',
  tt: 'TikTok',
  fb: 'Facebook',
  pin: 'Pinterest',
  meta: 'Meta Ads',
  other: 'Other',
}

export function channelLabel(channel: CalendarChannel) {
  return CHANNEL_LABELS[channel] || 'Other'
}

function storageKey(userId: string) {
  return `luce.calendar.${userId}`
}

export function loadCalendarItems(userId: string): CalendarItem[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCalendarItem)
  } catch {
    return []
  }
}

export function saveCalendarItems(userId: string, items: CalendarItem[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(items))
}

function isCalendarItem(value: unknown): value is CalendarItem {
  if (!value || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.title === 'string' &&
    typeof o.channel === 'string' &&
    typeof o.date === 'string' &&
    typeof o.time === 'string' &&
    typeof o.status === 'string'
  )
}

export function startOfWeek(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function toDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatWeekRange(weekStart: Date) {
  const end = addDays(weekStart, 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const startLabel = weekStart.toLocaleDateString(undefined, opts)
  const endLabel = end.toLocaleDateString(undefined, {
    ...opts,
    year: 'numeric',
  })
  return `${startLabel} – ${endLabel}`
}

export function dayLabel(date: Date, todayKey: string) {
  const key = toDateKey(date)
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
  const day = date.getDate()
  return {
    key,
    label: `${weekday} ${day}`,
    isToday: key === todayKey,
  }
}

export function newCalendarId() {
  return `cal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
