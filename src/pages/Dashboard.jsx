import { Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  dismissReminderOccurrence
} from '../api/eventsMock.js'
import RemindersPanel from '../components/RemindersPanel.jsx'
import EventForm from '../components/EventForm.jsx'
import apiService from '../api/apiService.js'
import { uid } from '../utils/common.js'
const DAY = 24*60*60*1000

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Authenticator>
        {({ signOut, user }) => <Shell signOut={signOut} user={user} />}
      </Authenticator>
    </div>
  )
}

function Shell({ signOut, user }) {
  const userId = user?.userId || user?.username || 'me';
  const [events, setEvents] = useState([]);          // masters
  const [occurrences, setOccurrences] = useState([]); // expanded, upcoming window
  const [reminders, setReminders] = useState([]);    // due now (next 24h)
  const [editing, setEditing] = useState(null);

  const HORIZON_DAYS = 60;

  const refresh = async () => {
    const masters = await apiService.getEvents(userId);
    setEvents(masters);
    setOccurrences(masters);
    const now = Date.now();
    setReminders(await apiService.getReminders(userId));
    //setOccurrences(getUpcomingOccurrences(masters, userId)); //, now, now + HORIZON_DAYS * DAY));
    setOccurrences(getUpcomingOccurrences(masters, userId));
  }

  useEffect(() => { refresh() }, [])

  const handleSave = async (draft) => {
    if (draft?.id) await apiService.updateEvent(userId, draft.id, draft)
    else await apiService.createEvent(uid(), userId, draft);
    setEditing(null);
    await refresh();
  }

  const handleDelete = async (id) => {
    await apiService.deleteEvent(userId, id);
    await refresh();
  }

  const handleDismiss = async (eventId, startAtISO) => {
    await dismissReminderOccurrence(userId, eventId, startAtISO);
    await refresh();
  }

  const grouped = groupByDate(occurrences);

  return (
    <div className="w-full px-6 py-6 h-screen">
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold">Dashboard</div>
        <div className="flex items-center gap-2">
          <Link to="/app" className="px-3 py-1.5 border rounded-2xl hover:shadow">Notes</Link>
          <button onClick={signOut} className="px-3 py-1.5 border rounded-2xl hover:shadow">Sign out</button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-12 gap-4 h-[calc(100%-4rem)]">
        <div className="col-span-5">
          {/* Quick add / edit */}
          <div className="mt-4 rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{editing ? 'Edit event' : 'Add event'}</div>
              {editing ? <button className="text-xs px-2 py-1 border rounded" onClick={() => setEditing(null)}>Cancel</button> : null}
            </div>
            <div className="mt-3">
              <EventForm initial={editing} onSave={handleSave} onCancel={() => setEditing(null)} />
            </div>
          </div>
        </div>
        <div className="col-span-7">
          {/* Reminders due now */}
          <div className="mt-4">
            <RemindersPanel reminders={reminders} onDismiss={handleDismiss} />
          </div>
          <div className="mt-4 rounded-2xl border bg-white p-4">
            <div className="text-xl font-semibold">All Active Events</div>
            <div className="mt-6 space-y-6">
              {Object.keys(grouped).length === 0 ? (
                <div className="rounded-2xl border bg-white p-4 text-sm text-gray-600">No upcoming events.</div>
              ) : (
                Object.entries(grouped).map(([day, items]) => (
                  <div key={day} className="rounded-2xl border bg-white">
                    <div className="rounded-2xl border bg-blue-100 p-4 shadow-sm">{day}</div>
                    <ul className="p-4 space-y-2">
                      {items.map(occ => {
                        const ev = events.find(e => e.id === occ.eventId);
                        const start = new Date(occ.start_at);
                        const key = occ.eventId + '|' + occ.start_at;
                        return (
                          <li key={key} className="flex items-start justify-between rounded-xl border p-3">
                            <div>
                              <div className="font-medium">{occ.title}</div>
                              <div className="text-xs text-gray-600">
                                {start.toLocaleString()} {occ.location ? `• ${occ.location}` : ''}
                              </div>
                              {occ.notes ? <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{occ.notes}</div> : null}
                            </div>
                            <div className="flex items-center gap-2">
                              {ev ? <button className="text-xs px-2 py-1 border rounded hover:bg-white" onClick={() => setEditing(ev)}>Edit</button> : null}
                              {ev ? <button className="text-xs px-2 py-1 border rounded hover:bg-white" onClick={() => handleDelete(ev.id)}>Delete</button> : null}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function groupByDate(occs){
  const fmt = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth()+1).padStart(2,'0')
    const day = String(d.getDate()).padStart(2,'0')
    return `${y}-${m}-${day}`
  }
  const g = {}
  for (const o of occs) {
    const temp = o.start_at || o.startAt || o.startAtISO || o.startAtIso || o.startAtiso || o.startAtISO;
    const start = new Date(temp);
    const key = fmt(start);
    if (!o.start_at) o.start_at = temp;
    g[key] = g[key] || []
    g[key].push(o)
  }
  console.log('groupByDate:', g)
  return g
}

/** Expand masters -> occurrences for a window (keeps 1-day-ahead reminder) */
function getUpcomingOccurrences(allEvent, userId = null, days = 60, from = null) {
  const uid = userId || this.userId;
  const minStartAt = allEvent.reduce((min, e) => {
    const d = new Date(e.start_at || e.startAt || e.startAtISO || e.startAtIso || e.startAtiso);
    return (!min || d < min) ? d : min;
  }, null) || from || new Date();
  const fromMs = +minStartAt;
  const toMs = fromMs + days * 24 * 60 * 60 * 1000;

  const occs = [];
  for (const e of allEvent) {
    occs.push(...expandEvent(e, fromMs, toMs));
  }
  // Filter out master-level dismissals (per-occurrence dismissal needs a separate API/table)
  const filtered = occs.filter(o => !o.reminder_dismissed);
  // Sort by start time
  return filtered.sort((a, b) => new Date(a.start_at || a.startAt || a.startAtISO || a.startAtIso || a.startAtiso || a.startAtISO) - 
                                 new Date(b.start_at || b.startAt || b.startAtISO || b.startAtIso || b.startAtiso || b.startAtISO));
}

function expandEvent(evt, fromMs, toMs) {
  const push = (d) => {
    const iso = new Date(d).toISOString();
    return {
      eventId: evt.id,
      title: evt.title,
      notes: evt.notes,
      location: evt.location,
      startAtISO: iso,
      reminderAtISO: new Date(new Date(iso).getTime() - 24*60*60*1000).toISOString(),
      reminder_dismissed: !!evt.reminder_dismissed,
    };
  };

  const out = [];
  const start = new Date(evt.start_at || evt.startAt || evt.startAtISO || evt.startAtIso || evt.startAtiso || evt.startAtISO);
  if (Number.isNaN(+start)) return out;
  const from = new Date(fromMs), to = new Date(toMs);

  const within = (d) => d >= from && d <= to;

  // No recurrence
  if (!evt.recurrence_freq && !evt.recurrence_interval && !evt.recurrence_by_weekday && !evt.recurrence_until && !evt.recurrence) {
    if (within(start)) out.push(push(start));
    return out;
  }

  // Normalize recurrence fields from DB or UI
  const r = evt.recurrence || {
    freq: (evt.recurrence_freq || '').toUpperCase() || 'NONE',
    interval: parseInt(evt.recurrence_interval || 1, 10),
    byWeekday: (() => {
      try {
        if (!evt.recurrence_by_weekday) return undefined;
        return Array.isArray(evt.recurrence_by_weekday)
          ? evt.recurrence_by_weekday
          : JSON.parse(evt.recurrence_by_weekday);
      } catch { return undefined; }
    })(),
    untilISO: evt.recurrence_until ? new Date(evt.recurrence_until).toISOString() : undefined,
  };

  if (r.freq === 'NONE') {
    if (within(start)) out.push(push(start));
    return out;
  }

  const until = r.untilISO ? new Date(r.untilISO) : null;
  const add = {
    days: (d, n) => { const t = new Date(d); t.setDate(t.getDate() + n); return t; },
    weeks: (d, n) => { const t = new Date(d); t.setDate(t.getDate() + n * 7); return t; },
    monthsClamped: (d, n) => {
      const b = new Date(d);
      const y = b.getFullYear(), m = b.getMonth(), day = b.getDate();
      const t = new Date(y, m + n, 1, b.getHours(), b.getMinutes(), b.getSeconds(), b.getMilliseconds());
      const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
      t.setDate(Math.min(day, last));
      return t;
    },
    yearsClamped: (d, n) => {
      const b = new Date(d);
      const t = new Date(b);
      t.setFullYear(b.getFullYear() + n);
      // clamp Feb 29
      if (b.getMonth() === 1 && b.getDate() === 29 && t.getMonth() === 1 && t.getDate() === 1) {
        t.setDate(28);
      }
      return t;
    },
  };
  const sameTimeAs = (base, d) => {
    const b = new Date(base), t = new Date(d);
    t.setHours(b.getHours(), b.getMinutes(), b.getSeconds(), b.getMilliseconds());
    return t;
  };

  const emitRangeGuard = (dt) => {
    if (within(dt) && (!until || dt <= until)) out.push(push(dt));
  };

  const interval = Math.max(1, parseInt(r.interval || 1, 10));
  const freq = r.freq;

  if (freq === 'DAILY') {
    let cur = new Date(start);
    if (cur < from) {
      const diffDays = Math.ceil((from - cur) / (24*60*60*1000));
      const steps = Math.ceil(diffDays / interval) * interval;
      cur = add.days(cur, steps);
    }
    while (cur <= to && (!until || cur <= until)) {
      emitRangeGuard(cur);
      cur = add.days(cur, interval);
    }
    return out;
  }

  if (freq === 'WEEKLY') {
    const days = (Array.isArray(r.byWeekday) && r.byWeekday.length)
      ? [...r.byWeekday].sort((a,b)=>a-b)
      : [start.getDay()];
    // Move week by week; generate chosen DOWs
    const startWeek = (d) => { const t = new Date(d); t.setHours(0,0,0,0); t.setDate(t.getDate() - t.getDay()); return t; };
    const baseWeek0 = startWeek(start);
    let w = 0;
    // advance to first relevant week
    while (true) {
      const candidateWeek = add.weeks(baseWeek0, w);
      // align to window
      if (candidateWeek >= startWeek(from)) break;
      w += interval;
    }
    while (true) {
      const weekStart = add.weeks(baseWeek0, w);
      if (weekStart > to || (until && weekStart > until)) break;
      for (const dow of days) {
        const occ = sameTimeAs(start, add.days(weekStart, dow));
        if (occ < start) continue;
        emitRangeGuard(occ);
      }
      w += interval;
    }
    return out;
  }

  if (freq === 'MONTHLY') {
    let cur = new Date(start);
    // jump forward to window
    if (cur < from) {
      const monthsDiff = (from.getFullYear() - cur.getFullYear()) * 12 + (from.getMonth() - cur.getMonth());
      const steps = Math.ceil(monthsDiff / interval) * interval;
      cur = add.monthsClamped(cur, steps);
    }
    while (cur <= to && (!until || cur <= until)) {
      emitRangeGuard(cur);
      cur = add.monthsClamped(cur, interval);
    }
    return out;
  }

  if (freq === 'YEARLY') {
    let cur = new Date(start);
    if (cur < from) {
      const yearsDiff = from.getFullYear() - cur.getFullYear();
      const steps = Math.ceil(yearsDiff / interval) * interval;
      cur = add.yearsClamped(cur, steps);
    }
    while (cur <= to && (!until || cur <= until)) {
      emitRangeGuard(cur);
      cur = add.yearsClamped(cur, interval);
    }
    return out;
  }

  // unknown freq -> just emit start if in range
  if (within(start)) out.push(push(start));
  return out;
}