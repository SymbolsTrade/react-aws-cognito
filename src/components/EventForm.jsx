import { useState, useEffect } from 'react'

const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function EventForm({ initial, onSave, onCancel }) {
  const temp = initial?.start_at || initial?.startAt || initial?.startAtISO || initial?.startAtIso || initial?.startAtiso || initial?.startAtISO;
  const [title, setTitle] = useState(initial?.title || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [location, setLocation] = useState(initial?.location || '')
  const [datetimeLocal, setDatetimeLocal] = useState(toLocalInput(temp))

  // Recurrence state
  const [freq, setFreq] = useState(initial?.recurrence?.freq || 'NONE')
  const [interval, setInterval] = useState(String(initial?.recurrence?.interval || 1))
  const [byWeekday, setByWeekday] = useState(initial?.recurrence?.byWeekday || [])
  const [untilDate, setUntilDate] = useState(toDateInput(initial?.recurrence?.untilISO))

  useEffect(() => {
    setTitle(initial?.title || '')
    setNotes(initial?.notes || '')
    setLocation(initial?.location || '')
    setDatetimeLocal(toLocalInput(temp))
    setFreq(initial?.recurrence?.freq || 'NONE')
    setInterval(String(initial?.recurrence?.interval || 1))
    setByWeekday(initial?.recurrence?.byWeekday || [])
    setUntilDate(toDateInput(initial?.recurrence?.untilISO))
  }, [initial?.id])

  const toggleDow = (d) => {
    setByWeekday(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a,b)=>a-b))
  }

  const submit = (e) => {
    e.preventDefault()
    const startAtISO = datetimeLocal ? new Date(datetimeLocal).toISOString() : new Date().toISOString()
    const recurrence = freq === 'NONE' ? null : {
      freq,
      interval: parseInt(interval || '1', 10),
      byWeekday: freq === 'WEEKLY' ? byWeekday : undefined,
      untilISO: untilDate ? new Date(untilDate + 'T23:59:59').toISOString() : undefined
    }
    onSave({
      ...initial,
      title: title.trim() || 'Untitled event',
      notes, location, startAtISO, recurrence
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">Title</label>
          <input className="mt-1 w-full rounded-xl border px-3 py-2"
                 value={title} onChange={e => setTitle(e.target.value)} placeholder="Event title" required />
        </div>
        <div>
          <label className="block text-sm font-medium">Location</label>
          <input className="mt-1 w-full rounded-xl border px-3 py-2"
                 value={location} onChange={e => setLocation(e.target.value)} placeholder="Optional location" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Notes</label>
        <textarea className="mt-1 w-full rounded-xl border px-3 py-2 min-h-[120px]"
                  value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">Date & time</label>
          <input type="datetime-local" className="mt-1 w-full rounded-xl border px-3 py-2"
                 value={datetimeLocal} onChange={e => setDatetimeLocal(e.target.value)} required />
        </div>

        <div>
          <label className="block text-sm font-medium">Repeat</label>
          <select className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={freq} onChange={e => setFreq(e.target.value)}>
            <option value="NONE">Does not repeat</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </div>
      </div>

      {freq !== 'NONE' && (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">Every</label>
              <input type="number" min="1" className="mt-1 w-full rounded-xl border px-3 py-2"
                     value={interval} onChange={e => setInterval(e.target.value)} />
              <div className="text-xs text-gray-500 mt-1">
                {freq === 'DAILY' && 'days'}
                {freq === 'WEEKLY' && 'weeks'}
                {freq === 'MONTHLY' && 'months'}
                {freq === 'YEARLY' && 'years'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Ends (optional)</label>
              <input type="date" className="mt-1 w-full rounded-xl border px-3 py-2"
                     value={untilDate} onChange={e => setUntilDate(e.target.value)} />
            </div>
          </div>

          {freq === 'WEEKLY' && (
            <div>
              <label className="block text-sm font-medium">On days</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {DOW.map((lbl, i) => (
                  <button type="button" key={i}
                    className={
                      "text-xs px-2 py-1 rounded border " +
                      (byWeekday.includes(i) ? "bg-blue-600 text-white border-blue-600" : "bg-white")
                    }
                    onClick={() => toggleDow(i)}>
                    {lbl}
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Tip: leave empty to default to the start date’s weekday.
              </div>
            </div>
          )}

          <div className="text-xs text-gray-600">
            Reminders appear <strong>1 day before each occurrence</strong>.
          </div>
        </>
      )}

      <div className="pt-2 flex items-center gap-2">
        <button type="submit" className="px-4 py-2 rounded-2xl border shadow-sm hover:shadow">Save event</button>
        {onCancel ? <button type="button" className="px-3 py-1.5 rounded-2xl border" onClick={onCancel}>Cancel</button> : null}
      </div>
    </form>
  )
}

function toLocalInput(iso){
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n)=> String(n).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function toDateInput(iso){
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n)=> String(n).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}
