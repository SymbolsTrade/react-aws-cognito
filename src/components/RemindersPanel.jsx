export default function RemindersPanel({ reminders, onDismiss }) {
  // reminders: [{eventId, title, notes, location, startAtISO, reminderAtISO}]
  if (!reminders?.length) return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-sm text-gray-600">No reminders due right now. Events scheduled for tomorrow will appear here automatically.</div>
    </div>
  )
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="font-semibold mb-2">Tomorrow Events</div>
      <ul className="space-y-2">
        {reminders.map(r => {
          const temp = r.start_at || r.startAt || r.startAtISO || r.startAtIso || r.startAtiso || r.startAtISO;
          const start = new Date(temp);
          const key = r.eventId + '|' + temp;
          return (
            <li key={key} className="flex items-start justify-between rounded-xl border p-3">
              <div>
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-gray-600">
                  {start.toLocaleString()} {r.location ? `• ${r.location}` : ''}
                </div>
                {r.notes ? <div className="mt-1 text-sm text-gray-700">{r.notes}</div> : null}
              </div>
              <button
                onClick={() => onDismiss(r.eventId, temp)}
                className="text-xs px-2 py-1 border rounded hover:bg-white"
              >
                Dismiss
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
