const PFX_FOLDERS = 'notes-folders:v1'
const PFX_NOTES   = 'notes-in-folder:v1'
const sleep = (ms=120) => new Promise(res => setTimeout(res, ms))
const uid = () => (crypto && crypto.randomUUID) ? crypto.randomUUID() :
  Math.random().toString(36).slice(2) + Date.now()

const fKey = (userId) => `${PFX_FOLDERS}:${userId || 'anonymous'}`
const nKey = (userId, folderId) => `${PFX_NOTES}:${userId || 'anonymous'}:${folderId}`

function loadFolders(userId) { const raw = localStorage.getItem(fKey(userId)); return raw ? JSON.parse(raw) : [] }
function saveFolders(userId, rows) { localStorage.setItem(fKey(userId), JSON.stringify(rows)) }
function loadNotes(userId, folderId) { const raw = localStorage.getItem(nKey(userId, folderId)); return raw ? JSON.parse(raw) : [] }
function saveNotes(userId, folderId, rows) { localStorage.setItem(nKey(userId, folderId), JSON.stringify(rows)) }

function seedIfEmpty(userId) {
  let folders = loadFolders(userId)
  if (folders.length === 0) {
    const now = Date.now()
    const general = { id: uid(), name: 'General', createdAt: now, updatedAt: now }
    const ideas   = { id: uid(), name: 'Ideas',   createdAt: now, updatedAt: now }
    folders = [general, ideas]
    saveFolders(userId, folders)
    saveNotes(userId, general.id, [
      { id: uid(), folderId: general.id, title: 'Welcome to Notes Keeper', content: 'Try folders and the new reminders dashboard.', createdAt: now, updatedAt: now },
      { id: uid(), folderId: general.id, title: 'Trading ideas', content: 'Mean reversion, RSI(14) notes…', createdAt: now, updatedAt: now },
    ])
    saveNotes(userId, ideas.id, [])
  }
  return loadFolders(userId)
}

export async function getFolders(userId){ await sleep(); return seedIfEmpty(userId) }
export async function createFolder(userId, name){
  await sleep()
  const folders = seedIfEmpty(userId)
  const now = Date.now()
  const row = { id: uid(), name: name?.trim() || 'Untitled', createdAt: now, updatedAt: now }
  saveFolders(userId, [row, ...folders]); saveNotes(userId, row.id, []); return row
}
export async function renameFolder(userId, folderId, name){
  await sleep()
  const folders = seedIfEmpty(userId)
  const i = folders.findIndex(f => f.id === folderId); if (i === -1) return null
  folders[i] = { ...folders[i], name: name?.trim() || folders[i].name, updatedAt: Date.now() }
  saveFolders(userId, folders); return folders[i]
}
export async function deleteFolder(userId, folderId){
  await sleep()
  const folders = seedIfEmpty(userId)
  saveFolders(userId, folders.filter(f => f.id !== folderId))
  localStorage.removeItem(nKey(userId, folderId)); return true
}

export async function getNotesInFolder(userId, folderId){ await sleep(); return loadNotes(userId, folderId) }
export async function createNote(userId, folderId, note){
  await sleep()
  const rows = loadNotes(userId, folderId); const now = Date.now()
  const n = { id: uid(), folderId, title: note?.title?.trim() || 'Untitled', content: note?.content || '', createdAt: now, updatedAt: now }
  rows.unshift(n); saveNotes(userId, folderId, rows); return n
}
export async function updateNote(userId, folderId, id, patch){
  await sleep()
  const rows = loadNotes(userId, folderId); const i = rows.findIndex(r => r.id === id); if (i === -1) return null
  rows[i] = { ...rows[i], ...patch, updatedAt: Date.now(), folderId }; saveNotes(userId, folderId, rows); return rows[i]
}
export async function deleteNote(userId, folderId, id){
  await sleep(); saveNotes(userId, folderId, loadNotes(userId, folderId).filter(r => r.id !== id)); return true
}
export async function searchNotesInFolder(userId, folderId, query){
  await sleep(); const q = (query||'').toLowerCase().trim(); const rows = loadNotes(userId, folderId); if (!q) return rows
  const terms = q.split(/\s+/).filter(Boolean)
  return rows.filter(n => {
    const hay = [n.title?.toLowerCase()||'', n.content?.toLowerCase()||''].join(' ')
    return terms.every(t => hay.includes(t))
  })
}
export async function importNotes(userId, folderId, arr){
  await sleep(); if (!Array.isArray(arr)) throw new Error('JSON must be an array of notes')
  const rows = loadNotes(userId, folderId); const now = Date.now()
  const normalized = arr.map(x => ({ id: uid(), folderId, title: (x.title ?? 'Untitled').toString(), content: (x.content ?? '').toString(), createdAt: now, updatedAt: now }))
  saveNotes(userId, folderId, [...normalized, ...rows]); return normalized.length
}
