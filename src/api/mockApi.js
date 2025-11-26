// LocalStorage-backed mock API with folders and note ordering.
// Storage (per user):
// - folders:  notes-folders:v1:<userId>         => [{id,name,createdAt,updatedAt}]
// - notes:    notes-in-folder:v1:<userId>:<fid> => [{id,folderId,title,content,sort_index,createdAt,updatedAt}]

const PFX_FOLDERS = 'notes-folders:v1'
const PFX_NOTES   = 'notes-in-folder:v1'

const sleep = (ms=120) => new Promise(res => setTimeout(res, ms))
const uid = () => (crypto && crypto.randomUUID) ? crypto.randomUUID()
  : Math.random().toString(36).slice(2) + Date.now()

const fKey = (userId) => `${PFX_FOLDERS}:${userId || 'anonymous'}`
const nKey = (userId, folderId) => `${PFX_NOTES}:${userId || 'anonymous'}:${folderId}`

function loadFolders(userId) {
  const raw = localStorage.getItem(fKey(userId))
  return raw ? JSON.parse(raw) : []
}
function saveFolders(userId, rows) { localStorage.setItem(fKey(userId), JSON.stringify(rows)) }

function loadNotes(userId, folderId) {
  const raw = localStorage.getItem(nKey(userId, folderId))
  return raw ? JSON.parse(raw) : []
}
function saveNotes(userId, folderId, rows) {
  localStorage.setItem(nKey(userId, folderId), JSON.stringify(rows))
}

function nextTopPosition(rows) {
  // smaller sort_index = appears first
  const minPos = rows.reduce((m, r) => Math.min(m, r.sort_index ?? Infinity), Infinity)
  return Number.isFinite(minPos) ? (minPos - 1000) : 1000
}

function normalizePositions(rows) {
  // compress to 1000,2000,...
  return rows
    .slice()
    .sort((a,b) => (a.sort_index??0) - (b.sort_index??0))
    .map((r, i) => ({ ...r, sort_index: (i+1)*1000 }))
}

function seedIfEmpty(userId) {
  let folders = loadFolders(userId)
  if (folders.length === 0) {
    const now = Date.now()
    const general = { id: uid(), name: 'General', createdAt: now, updatedAt: now }
    const ideas   = { id: uid(), name: 'Ideas',   createdAt: now, updatedAt: now }
    folders = [general, ideas]
    saveFolders(userId, folders)

    saveNotes(userId, general.id, normalizePositions([
      { id: uid(), folderId: general.id, title: 'Welcome to Notes Keeper', content: 'Try drag & drop to reorder, or drop onto a folder to move.', sort_index: 1000, createdAt: now, updatedAt: now },
      { id: uid(), folderId: general.id, title: 'Trading ideas', content: 'Mean reversion, RSI(14) notes…', sort_index: 2000, createdAt: now, updatedAt: now },
    ]))
    saveNotes(userId, ideas.id, [])
  }
  return loadFolders(userId)
}

/* Folders */
export async function getFolders(userId) { await sleep(); return seedIfEmpty(userId) }
export async function createFolder(userId, name) {
  await sleep()
  const folders = seedIfEmpty(userId)
  const now = Date.now()
  const row = { id: uid(), name: name?.trim() || 'Untitled', createdAt: now, updatedAt: now }
  const next = [row, ...folders]
  saveFolders(userId, next)
  saveNotes(userId, row.id, [])
  return row
}
export async function renameFolder(userId, folderId, name) {
  await sleep()
  const folders = seedIfEmpty(userId)
  const i = folders.findIndex(f => f.id === folderId)
  if (i === -1) return null
  folders[i] = { ...folders[i], name: name?.trim() || folders[i].name, updatedAt: Date.now() }
  saveFolders(userId, folders)
  return folders[i]
}
export async function deleteFolder(userId, folderId) {
  await sleep()
  const folders = seedIfEmpty(userId)
  const next = folders.filter(f => f.id !== folderId)
  saveFolders(userId, next)
  localStorage.removeItem(nKey(userId, folderId))
  return true
}

/* Notes */
export async function getNotesInFolder(userId, folderId) {
  await sleep()
  return loadNotes(userId, folderId)
    .slice()
    .sort((a,b) => (a.sort_index??0) - (b.sort_index??0))
}
export async function createNote(userId, folderId, note) {
  await sleep()
  const rows = loadNotes(userId, folderId)
  const now = Date.now()
  const n = {
    id: uid(),
    folderId,
    title: note?.title?.trim() || 'Untitled',
    content: note?.content || '',
    sort_index: nextTopPosition(rows), // add to top
    createdAt: now,
    updatedAt: now
  }
  rows.push(n) // position will be sorted by sort_index anyway
  saveNotes(userId, folderId, rows)
  return n
}
export async function updateNote(userId, folderId, id, patch) {
  await sleep()
  const rows = loadNotes(userId, folderId)
  const i = rows.findIndex(r => r.id === id)
  if (i === -1) return null
  rows[i] = { ...rows[i], ...patch, updatedAt: Date.now(), folderId }
  saveNotes(userId, folderId, rows)
  return rows[i]
}
export async function deleteNote(userId, folderId, id) {
  await sleep()
  const rows = loadNotes(userId, folderId)
  const next = rows.filter(r => r.id !== id)
  saveNotes(userId, folderId, next)
  return true
}
export async function moveNote(userId, id, fromFolderId, toFolderId) {
  await sleep()
  if (fromFolderId === toFolderId) return null
  const from = loadNotes(userId, fromFolderId)
  const i = from.findIndex(r => r.id === id)
  if (i === -1) return null
  const to = loadNotes(userId, toFolderId)
  const moved = { ...from[i], folderId: toFolderId, updatedAt: Date.now(), sort_index: nextTopPosition(to) }
  const toNext = [...to, moved]
  saveNotes(userId, toFolderId, toNext)
  const fromNext = from.filter(r => r.id !== id)
  saveNotes(userId, fromFolderId, fromNext)
  return moved
}
export async function searchNotesInFolder(userId, folderId, query) {
  await sleep()
  const q = (query || '').toLowerCase().trim()
  const rows = await getNotesInFolder(userId, folderId)
  if (!q) return rows
  const terms = q.split(/\s+/).filter(Boolean)
  return rows.filter(n => {
    const hay = [n.title?.toLowerCase()||'', n.content?.toLowerCase()||''].join(' ')
    return terms.every(t => hay.includes(t))
  })
}
export async function importNotes(userId, folderId, arr) {
  await sleep()
  if (!Array.isArray(arr)) throw new Error('JSON must be an array of notes')
  const rows = loadNotes(userId, folderId)
  const now = Date.now()
  const base = rows.slice()
  for (const x of arr) {
    base.push({
      id: uid(),
      folderId,
      title: (x.title ?? 'Untitled').toString(),
      content: (x.content ?? '').toString(),
      sort_index: nextTopPosition(base),
      createdAt: now,
      updatedAt: now
    })
  }
  // optional normalize:
  saveNotes(userId, folderId, normalizePositions(base))
  return arr.length
}
export async function reorderNotes(userId, folderId, orderedIds) {
  await sleep()
  const rows = loadNotes(userId, folderId)
  const idToNote = new Map(rows.map(r => [r.id, r]))
  const re = []
  orderedIds.forEach((id, i) => {
    const n = idToNote.get(id)
    if (n) re.push({ ...n, sort_index: (i+1)*1000, updatedAt: Date.now() })
  })
  // append any stragglers (shouldn't happen)
  rows.forEach(n => { if (!orderedIds.includes(n.id)) re.push(n) })
  saveNotes(userId, folderId, re)
  return true
}
