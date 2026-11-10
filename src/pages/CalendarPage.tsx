import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import {
  addDays,
  channelLabel,
  dayLabel,
  formatWeekRange,
  loadCalendarItems,
  newCalendarId,
  saveCalendarItems,
  startOfWeek,
  toDateKey,
  type CalendarChannel,
  type CalendarItem,
  type CalendarStatus,
} from '../lib/contentCalendar'

const CHANNELS: CalendarChannel[] = ['ig', 'tt', 'fb', 'pin', 'meta', 'other']
const STATUSES: CalendarStatus[] = ['planned', 'ready', 'posted']

export default function CalendarPage() {
  const { user, loading } = useAuth()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [items, setItems] = useState<CalendarItem[]>([])
  const [composerOpen, setComposerOpen] = useState(false)
  const [draftDate, setDraftDate] = useState(toDateKey(new Date()))
  const [title, setTitle] = useState('')
  const [channel, setChannel] = useState<CalendarChannel>('ig')
  const [time, setTime] = useState('10:00')
  const [status, setStatus] = useState<CalendarStatus>('planned')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!user) return
    setItems(loadCalendarItems(user.uid))
  }, [user])

  const todayKey = toDateKey(new Date())
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  function persist(next: CalendarItem[]) {
    setItems(next)
    if (user) saveCalendarItems(user.uid, next)
  }

  function openComposer(dateKey: string) {
    setDraftDate(dateKey)
    setTitle('')
    setChannel('ig')
    setTime('10:00')
    setStatus('planned')
    setNote('')
    setComposerOpen(true)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const next: CalendarItem = {
      id: newCalendarId(),
      title: title.trim(),
      channel,
      date: draftDate,
      time,
      status,
      note: note.trim() || undefined,
    }
    persist([...items, next].sort(sortItems))
    setComposerOpen(false)
  }

  function updateStatus(id: string, nextStatus: CalendarStatus) {
    persist(
      items.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)),
    )
  }

  function removeItem(id: string) {
    persist(items.filter((item) => item.id !== id))
  }

  if (loading) {
    return (
      <div className="studio-shell studio-shell-alone">
        <p className="app-loading">Loading…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />

  return (
    <AppLayout>
      <main className="cal-page">
        <header className="cal-top">
          <div>
            <p className="cal-kicker">Calendar</p>
            <h1>Plan what goes out</h1>
            <p>Schedule creatives locally. Publishing to Instagram comes later — this is your planning board.</p>
          </div>
          <div className="cal-top-actions">
            <button
              type="button"
              className="brand-kit-ghost"
              onClick={() => setWeekStart(startOfWeek(new Date()))}
            >
              Today
            </button>
            <button
              type="button"
              className="brand-kit-ghost"
              aria-label="Previous week"
              onClick={() => setWeekStart((d) => addDays(d, -7))}
            >
              ←
            </button>
            <button
              type="button"
              className="brand-kit-ghost"
              aria-label="Next week"
              onClick={() => setWeekStart((d) => addDays(d, 7))}
            >
              →
            </button>
            <strong className="cal-range">{formatWeekRange(weekStart)}</strong>
            <button
              type="button"
              className="brand-kit-cta"
              onClick={() => openComposer(todayKey)}
            >
              + Plan post
            </button>
          </div>
        </header>

        <div className="cal-banner">
          <span aria-hidden="true">ℹ</span>
          <p>
            Posts stay on this calendar only. Connect social accounts later when you are ready to
            publish automatically.
          </p>
          <Link to="/app/studio/photos">Create creative</Link>
        </div>

        <div className="cal-week" role="grid" aria-label="Week calendar">
          {days.map((day) => {
            const meta = dayLabel(day, todayKey)
            const dayItems = items.filter((item) => item.date === meta.key)
            return (
              <section
                key={meta.key}
                className={`cal-day${meta.isToday ? ' is-today' : ''}`}
                aria-label={meta.label}
              >
                <header className="cal-day-head">
                  <strong>{meta.label}</strong>
                  <button
                    type="button"
                    className="cal-day-add"
                    onClick={() => openComposer(meta.key)}
                    aria-label={`Add post on ${meta.label}`}
                  >
                    +
                  </button>
                </header>
                <div className="cal-day-list">
                  {dayItems.length === 0 ? (
                    <p className="cal-empty">Nothing planned</p>
                  ) : (
                    dayItems.map((item) => (
                      <article key={item.id} className="cal-card">
                        <div className="cal-card-top">
                          <span>{item.title}</span>
                          <em>{item.time}</em>
                        </div>
                        <div className="cal-card-meta">
                          <span className={`cal-status is-${item.status}`}>
                            {item.status}
                          </span>
                          <span
                            className="cal-channel-dot"
                            data-channel={item.channel}
                            title={channelLabel(item.channel)}
                          />
                          <span>{channelLabel(item.channel)}</span>
                        </div>
                        {item.note ? <p className="cal-card-note">{item.note}</p> : null}
                        <div className="cal-card-actions">
                          <select
                            value={item.status}
                            aria-label="Status"
                            onChange={(e) =>
                              updateStatus(item.id, e.target.value as CalendarStatus)
                            }
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <button type="button" onClick={() => removeItem(item.id)}>
                            Remove
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            )
          })}
        </div>

        {composerOpen ? (
          <div
            className="cal-composer-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Plan a post"
            onClick={() => setComposerOpen(false)}
          >
            <form
              className="cal-composer"
              onClick={(e) => e.stopPropagation()}
              onSubmit={onSubmit}
            >
              <header>
                <h2>Plan a post</h2>
                <button type="button" onClick={() => setComposerOpen(false)} aria-label="Close">
                  ×
                </button>
              </header>
              <label>
                Title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="UGC video · serum"
                  autoFocus
                  required
                />
              </label>
              <div className="cal-composer-row">
                <label>
                  Date
                  <input
                    type="date"
                    value={draftDate}
                    onChange={(e) => setDraftDate(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Time
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                  />
                </label>
              </div>
              <div className="cal-composer-row">
                <label>
                  Channel
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as CalendarChannel)}
                  >
                    {CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {channelLabel(c)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CalendarStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Note
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional reminder"
                />
              </label>
              <div className="cal-composer-actions">
                <button type="button" className="brand-kit-ghost" onClick={() => setComposerOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="brand-kit-cta">
                  Save to calendar
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </main>
    </AppLayout>
  )
}

function sortItems(a: CalendarItem, b: CalendarItem) {
  if (a.date !== b.date) return a.date.localeCompare(b.date)
  return a.time.localeCompare(b.time)
}
