// LocalStorage-backed events API with recurrence and per-occurrence reminders.
//
// Storage key: events:v1:<userId>
// Event shape:
// {
//   id, title, notes, location,
//   startAtISO,                                // master start
//   recurrence: null | {
//     freq: 'DAILY'|'WEEKLY'|'MONTHLY'|'YEARLY',
//     interval: number,                        // >=1
//     byWeekday?: number[],                    // 0..6 (Sun..Sat) - WEEKLY only
//     untilISO?: string                        // optional end date (inclusive)
//   },
//   dismissedOccurrences?: string[],           // ISO of occurrence starts that were dismissed
//   createdAt, updatedAt
// }
//
// Exposed functions:
// - getEvents(userId)                          -> master rows (no expansion)
// - createEvent(userId, evt)
// - updateEvent(userId, id, patch)
// - deleteEvent(userId, id)
// - listOccurrencesInRange(userId, fromMs, toMs) -> expanded occurrences
// - getActiveReminders(userId, nowMs)          -> occurrences with reminders due now
// - getStartingWithinNextDay(userId, nowMs)    -> occurrences starting in next 24h
// - dismissReminderOccurrence(userId, eventId, occurrenceStartISO) -> mark one occurrence dismissed

const PFX = 'events:v1'
const DAY = 24 * 60 * 60 * 1000
const sleep = (ms=80) => new Promise(res => setTimeout(res, ms))
const uid = () => (crypto && crypto.randomUUID) ? crypto.randomUUID()
  : Math.random().toString(36).slice(2) + Date.now()

const key = (userId) => `${PFX}:${userId || 'anonymous'}`

function load(userId){ const raw = localStorage.getItem(key(userId)); return raw ? JSON.parse(raw) : [] }
function save(userId, rows){ localStorage.setItem(key(userId), JSON.stringify(rows)) }

function computeReminderISO(iso){
  try { return new Date(new Date(iso).getTime() - DAY).toISOString() } catch { return null }
}

function seedIfEmpty(userId){
  const rows = load(userId)
  if (rows.length === 0) {
    const now = Date.now()
    const startISO = new Date(now + 2*DAY).toISOString()
    const demo = [{
      id: uid(),
      title: 'Demo recurring (weekly, Mon/Fri)',
      notes: 'Dashboard reminds you 1 day before each occurrence.',
      location: 'Online',
      startAtISO: startISO,
      recurrence: { freq: 'WEEKLY', interval: 1, byWeekday: [1,5] }, // Mon/Fri
      dismissedOccurrences: [],
      createdAt: now, updatedAt: now
    }]
    save(userId, demo)
  }
}

// ---------- Recurrence helpers ----------
function sameTimeAs(base, d){
  // copy time-of-day from base into date d
  const b = new Date(base)
  const r = new Date(d)
  r.setHours(b.getHours(), b.getMinutes(), b.getSeconds(), b.getMilliseconds())
  return r
}
function startOfWeekSun(d){ const r = new Date(d); r.setHours(0,0,0,0); r.setDate(r.getDate() - r.getDay()); return r } // Sunday
function addDays(d,n){ const r = new Date(d); r.setDate(r.getDate()+n); return r }
function addWeeks(d,n){ return addDays(d, n*7) }
function lastDayOfMonth(y,m){ return new Date(y, m+1, 0).getDate() }
function addMonthsClamped(d, n){
  const base = new Date(d)
  const y = base.getFullYear(), m = base.getMonth(), day = base.getDate()
  const t = new Date(y, m+n, 1, base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds())
  const last = lastDayOfMonth(t.getFullYear(), t.getMonth())
  t.setDate(Math.min(day, last))
  return t
}
function addYearsClamped(d, n){
  const base = new Date(d)
  const t = new Date(base)
  t.setFullYear(base.getFullYear()+n)
  // clamp Feb 29 → Feb 28 in non-leap years
  if (base.getMonth() === 1 && base.getDate() === 29 && t.getMonth() === 1 && t.getDate() === 1) {
    t.setDate(28)
  }
  return t
}

function expandEventInRange(evt, fromMs, toMs){
  // returns array of { eventId, title, notes, location, startAtISO, reminderAtISO }
  // (startAtISO here is the *occurrence* start)
  const acc = []
  const from = new Date(fromMs)
  const to   = new Date(toMs)
  const start = new Date(evt.startAtISO)
  const until = evt.recurrence?.untilISO ? new Date(evt.recurrence.untilISO) : null

  const within = (d) => d >= from && d <= to && (!until || d <= until)

  const pushOcc = (d) => {
    const iso = d.toISOString()
    acc.push({
      eventId: evt.id,
      title: evt.title,
      notes: evt.notes,
      location: evt.location,
      startAtISO: iso,
      reminderAtISO: computeReminderISO(iso)
    })
  }

  if (!evt.recurrence || !evt.recurrence.freq || evt.recurrence.freq === 'NONE') {
    if (within(start)) pushOcc(start)
    return acc
  }

  const { freq, interval = 1, byWeekday } = evt.recurrence

  if (freq === 'DAILY') {
    // find first >= from
    let cur = new Date(start)
    if (cur < from) {
      const diffDays = Math.ceil((from - cur) / DAY)
      const steps = Math.max(0, Math.ceil(diffDays / interval) * interval)
      cur = addDays(cur, steps)
    }
    while (cur <= to && (!until || cur <= until)) {
      pushOcc(cur)
      cur = addDays(cur, interval)
    }
    return acc
  }

  if (freq === 'WEEKLY') {
    const days = (Array.isArray(byWeekday) && byWeekday.length > 0)
      ? [...byWeekday].sort((a,b)=>a-b)
      : [start.getDay()] // default to start day

    const baseWeekStart = startOfWeekSun(start)
    const windowWeekStart = startOfWeekSun(from)
    // how many weeks between baseWeekStart and windowWeekStart?
    const diffWeeks = Math.floor((windowWeekStart - baseWeekStart) / DAY / 7)
    // align to interval
    let weekIndex = diffWeeks >= 0 ? diffWeeks : 0
    while ((weekIndex % interval) !== 0) weekIndex++
    let curWeekStart = addWeeks(baseWeekStart, weekIndex)

    const endGuard = to // window end
    while (curWeekStart <= endGuard) {
      for (const dow of days) {
        let occ = addDays(curWeekStart, dow)
        occ = sameTimeAs(start, occ)
        if (occ < start) continue // don't emit before series start
        if (!within(occ)) continue
        pushOcc(occ)
      }
      weekIndex += interval
      curWeekStart = addWeeks(baseWeekStart, weekIndex)
      if (until && curWeekStart > until) break
    }
    return acc
  }

  if (freq === 'MONTHLY') {
    let cur = new Date(start)
    // move to first month >= from
    if (cur < from) {
      const monthsDiff = (from.getFullYear() - cur.getFullYear())*12 + (from.getMonth() - cur.getMonth())
      const steps = Math.max(0, Math.ceil(monthsDiff / interval) * interval)
      cur = addMonthsClamped(cur, steps)
    }
    while (cur <= to && (!until || cur <= until)) {
      pushOcc(cur)
      cur = addMonthsClamped(cur, interval)
    }
    return acc
  }

  if (freq === 'YEARLY') {
    let cur = new Date(start)
    if (cur < from) {
      const yearsDiff = from.getFullYear() - cur.getFullYear()
      const steps = Math.max(0, Math.ceil(yearsDiff / interval) * interval)
      cur = addYearsClamped(cur, steps)
    }
    while (cur <= to && (!until || cur <= until)) {
      pushOcc(cur)
      cur = addYearsClamped(cur, interval)
    }
    return acc
  }

  // fallback
  if (within(start)) pushOcc(start)
  return acc
}

export async function getEvents(userId){
  await sleep(); seedIfEmpty(userId)
  return load(userId).slice().sort((a,b) => new Date(a.startAtISO) - new Date(b.startAtISO))
}

export async function createEvent(userId, evt){
  await sleep()
  const rows = load(userId); const now = Date.now()
  const startISO = new Date(evt.startAtISO || evt.startAt || Date.now()).toISOString()
  const recurrence = normalizeRecurrence(evt.recurrence)
  const row = {
    id: uid(),
    title: (evt.title || 'Untitled event').trim(),
    notes: evt.notes || '',
    location: evt.location || '',
    startAtISO: startISO,
    recurrence,
    dismissedOccurrences: [],
    createdAt: now, updatedAt: now
  }
  rows.push(row); save(userId, rows); return row
}

export async function updateEvent(userId, id, patch){
  await sleep()
  const rows = load(userId); const i = rows.findIndex(r => r.id === id); if (i === -1) return null
  const next = { ...rows[i], ...patch, updatedAt: Date.now() }
  if (patch.startAtISO || patch.startAt) {
    next.startAtISO = new Date(patch.startAtISO || patch.startAt).toISOString()
  }
  if ('recurrence' in patch) {
    next.recurrence = normalizeRecurrence(patch.recurrence)
  }
  // ensure array exists
  if (!Array.isArray(next.dismissedOccurrences)) next.dismissedOccurrences = rows[i].dismissedOccurrences || []
  rows[i] = next; save(userId, rows); return next
}

export async function deleteEvent(userId, id){
  await sleep(); save(userId, load(userId).filter(r => r.id !== id)); return true
}

export async function listOccurrencesInRange(userId, fromMs, toMs){
  await sleep(); seedIfEmpty(userId)
  const rows = load(userId)
  const occs = []
  for (const e of rows) occs.push(...expandEventInRange(e, fromMs, toMs))
  // filter out dismissed occurrences
  return occs
    .filter(o => {
      const ev = rows.find(r => r.id === o.eventId)
      const dismissed = ev?.dismissedOccurrences || []
      return !dismissed.includes(o.startAtISO)
    })
    .sort((a,b) => new Date(a.startAtISO) - new Date(b.startAtISO))
}

export async function getActiveReminders(userId, nowMs = Date.now()){
  // Occurrences that start within next 24h where reminder time has passed (now >= start-1d) and not dismissed.
  const start = nowMs
  const end   = nowMs + DAY
  const occs = await listOccurrencesInRange(userId, start, end)
  return occs.filter(o => new Date(o.reminderAtISO).getTime() <= nowMs)
}

export async function getStartingWithinNextDay(userId, nowMs = Date.now()){
  const start = nowMs
  const end   = nowMs + DAY
  return listOccurrencesInRange(userId, start, end)
}

export async function dismissReminderOccurrence(userId, eventId, occurrenceStartISO){
  await sleep()
  const rows = load(userId); const i = rows.findIndex(r => r.id === eventId); if (i === -1) return null
  const ev = rows[i]
  if (!Array.isArray(ev.dismissedOccurrences)) ev.dismissedOccurrences = []
  if (!ev.dismissedOccurrences.includes(occurrenceStartISO)) {
    ev.dismissedOccurrences.push(occurrenceStartISO)
    ev.updatedAt = Date.now()
    rows[i] = ev
    save(userId, rows)
  }
  return true
}

// Back-compat (single non-recurring event)
export async function dismissReminder(userId, id){
  const now = Date.now()
  const due = await getActiveReminders(userId, now)
  const occ = due.find(o => o.eventId === id)
  if (occ) return dismissReminderOccurrence(userId, id, occ.startAtISO)
  return false
}

// Normalize recurrence object
function normalizeRecurrence(r){
  if (!r || !r.freq || r.freq === 'NONE') return null
  const freq = String(r.freq).toUpperCase()
  const interval = Math.max(1, parseInt(r.interval || 1, 10))
  const out = { freq, interval }
  if (freq === 'WEEKLY') {
    const days = Array.isArray(r.byWeekday) ? r.byWeekday.map(n => +n).filter(n => n>=0 && n<=6) : []
    if (days.length) out.byWeekday = Array.from(new Set(days)).sort((a,b)=>a-b)
  }
  if (r.untilISO) {
    try { out.untilISO = new Date(r.untilISO).toISOString() } catch {}
  }
  return out
}
