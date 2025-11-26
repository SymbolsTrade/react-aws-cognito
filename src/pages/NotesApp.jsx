import { Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { uid } from '../utils/common.js'
import { deleteFolder as mockDeleteFolder, deleteNote, reorderNotes } from '../api/mockApi.js'
import FolderList from '../components/FolderList.jsx'
import NotesList from '../components/NotesList.jsx'
import NoteForm from '../components/NoteForm.jsx'
import ImportJson from '../components/ImportJson.jsx'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import apiService from '../api/apiService.js'

export default function NotesApp() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Authenticator>
        {({ signOut, user }) => <NotesShell signOut={signOut} user={user} />}
      </Authenticator>
    </div>
  )
}

function NotesShell({ signOut, user }) {
  const userId = user?.userId || user?.username || 'me'

  const [folders, setFolders] = useState([])
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [notes, setNotes] = useState([])
  const [selectedNote, setSelectedNote] = useState(null)
  const [query, setQuery] = useState('')
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [importing, setImporting] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // DnD
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // Splitter state (desktop only)
  const [notesPaneW, setNotesPaneW] = useState(380)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef(null)
  const SIDEBAR_W = 240
  const NOTES_MIN = 280
  const EDITOR_MIN = 420
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

  const onDividerMouseDown = (e) => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setDragging(true)
      e.preventDefault()
    }
  }
  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      const root = containerRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      const totalW = rect.width
      const relX = e.clientX - rect.left
      const maxNotes = totalW - EDITOR_MIN
      setNotesPaneW(clamp(relX, NOTES_MIN, maxNotes))
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  // Load folders on mount
  useEffect(() => {
    (async () => {
      const f = await apiService.getFolders(userId)
      setFolders(f)
      setSelectedFolder(f[0] || null)
    })()
  }, [])

  // Load notes on folder/query change
  const refreshNotes = async (folderId = selectedFolder?.id, q = query) => {
    if (!folderId) return
    setLoadingNotes(true)
    const data = q
      ? await apiService.searchNotesInFolder(userId, folderId, q, notes)
      : await apiService.getNotesInFolder(userId, folderId)
    setNotes(data)
    if (data.length && (!selectedNote || !data.find(n => n.id === selectedNote.id))) {
      setSelectedNote(data[0])
    } else if (!data.length) {
      setSelectedNote(null)
    }
    setLoadingNotes(false)
  }
  useEffect(() => { refreshNotes() }, [selectedFolder?.id, query])

  // Folder ops
  const handleCreateFolder = async (name) => {
    const data = { id: uid(), name: name?.trim() || 'Untitled', user_id: userId }
    await apiService.createFolder(data)
    const f = await apiService.getFolders(userId)
    setFolders(f)
    setSelectedFolder(data)
  }
  const handleRenameFolder = async (id, name) => {
    const data = { id, name: name?.trim() || 'Untitled', user_id: userId }
    await apiService.updateFolder(id, data)
    setFolders(await apiService.getFolders(userId))
  }
  const handleDeleteFolder = async (id) => {
    await mockDeleteFolder(userId, id)
    const f = await apiService.getFolders(userId)
    setFolders(f)
    if (selectedFolder?.id === id) setSelectedFolder(f[0] || null)
  }

  // Note ops
  const handleSaveNote = async (draft) => {
    if (draft?.id) {
      await apiService.updateNote(userId, draft.folderId, draft.id, draft)
      setSelectedFolder(folders.find(f => f.id === draft.folderId) || selectedFolder)
    } else {
      const folderId = draft.folderId || selectedFolder?.id
      await apiService.createNote(uid(), userId, folderId, draft)
    }
    await refreshNotes(draft.folderId || selectedFolder?.id)
    toast('Note saved successfully!')
  }
  const handleDeleteNote = async (id) => {
    if (!selectedFolder) return
    await deleteNote(userId, selectedFolder.id, id)
    await refreshNotes(selectedFolder.id)
    if (selectedNote?.id === id) setSelectedNote(null)
  }
  const handleImport = async (arr) => {
    if (!selectedFolder) return
    const payload = arr.map(n => ({
      id: uid(),
      user_id: userId,
      folder_id: selectedFolder.id,
      title: n.title?.trim() || 'Untitled',
      content: n.content || ''
    }))
    await apiService.createBulkNotes(userId, selectedFolder.id, payload)
    await refreshNotes(selectedFolder.id)
    setImporting(false)
    toast(`Imported ${payload.length} notes`)
  }

  // DnD: move or reorder
  const onDragEnd = async ({ active, over }) => {
    if (!over || !active) return
    const aId = String(active.id)
    const oId = String(over.id)

    // Move note → folder
    if (aId.startsWith('note:') && oId.startsWith('folder:')) {
      const noteId = aId.replace('note:', '')
      const targetFolderId = oId.replace('folder:', '')
      if (!selectedFolder || targetFolderId === selectedFolder.id) return
      await apiService.updateNote(userId, targetFolderId, noteId, { folderId: targetFolderId })
      await refreshNotes(selectedFolder.id)
      return
    }

    // Reorder within folder
    if (aId.startsWith('note:') && oId.startsWith('note:')) {
      const fromId = aId.replace('note:', '')
      const toId = oId.replace('note:', '')
      if (fromId === toId) return
      const current = notes.slice()
      const fromIdx = current.findIndex(n => n.id === fromId)
      const toIdx = current.findIndex(n => n.id === toId)
      if (fromIdx === -1 || toIdx === -1) return
      const next = arrayMove(current, fromIdx, toIdx)
      setNotes(next) // optimistic
      await reorderNotes(userId, selectedFolder.id, next.map(n => n.id))
    }
  }

  const toast = (msg) => {
    setSaveMsg(msg)
    setTimeout(() => setSaveMsg(''), 4000)
  }

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
        <div className="w-full px-3 sm:px-4 lg:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden inline-flex items-center justify-center rounded-xl border px-3 py-1.5"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open folders"
            >
              ☰
            </button>
            <div className="text-lg font-semibold tracking-tight">Notes Keeper</div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard" className="hidden sm:inline px-3 py-1.5 border rounded-2xl hover:shadow">Dashboard</Link>
            <button onClick={() => setImporting(v => !v)} className="px-3 py-1.5 border rounded-2xl hover:shadow">Import JSON</button>
            <button onClick={signOut} className="px-3 py-1.5 border rounded-2xl hover:shadow">Sign out</button>
          </div>
        </div>
      </header>

      {/* Toast */}
      {saveMsg && (
        <div className="pointer-events-none fixed inset-x-0 top-[68px] z-30 flex justify-center">
          <div className="pointer-events-auto bg-white border shadow rounded-xl px-4 py-2 text-sm text-green-700">
            {saveMsg}
          </div>
        </div>
      )}

      {/* MAIN AREA (scrolls) */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        {/* Make this flex child shrink and scroll correctly */}
        <div className="flex-1 min-h-0 w-full px-3 sm:px-4 lg:px-6 py-4 lg:pb-0 pb-16">
          {/* ---------- MOBILE/TABLET (<lg) STACK ---------- */}
          <div className="lg:hidden h-full flex flex-col gap-4">
            {/* slide-over for folders */}
            {sidebarOpen && (
              <>
                <div
                  className="fixed inset-0 bg-black/30 backdrop-blur-[1px] z-40 lg:hidden"
                  onClick={() => setSidebarOpen(false)}
                  aria-hidden="true"
                />
                <div className="fixed inset-y-0 left-0 w-[85%] max-w-[360px] z-50 lg:hidden">
                  <div className="h-full bg-white border-r rounded-r-2xl shadow-xl overflow-hidden">
                    <div className="p-3 border-b flex items-center justify-between">
                      <div className="font-semibold">Folders</div>
                      <button
                        className="inline-flex items-center justify-center rounded-lg border px-2 py-1 text-sm"
                        onClick={() => setSidebarOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                    <FolderList
                      folders={folders}
                      selectedId={selectedFolder?.id}
                      onSelect={(f) => { setSelectedFolder(f); setSidebarOpen(false) }}
                      onCreate={handleCreateFolder}
                      onRename={handleRenameFolder}
                      onDelete={handleDeleteFolder}
                    />
                  </div>
                </div>
              </>
            )}

            {/* notes list */}
            <div className="rounded-2xl border bg-white flex flex-col min-h-[260px]">
              <div className="p-3 border-b flex items-center gap-2">
                <input
                  className="flex-1 rounded-2xl border px-3 py-2 text-sm"
                  placeholder={`Search in ${selectedFolder?.name || 'folder'}...`}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  disabled={!selectedFolder}
                />
                <button
                  onClick={() => setSelectedNote({ folderId: selectedFolder?.id })}
                  className="px-3 py-1.5 border rounded-2xl text-sm"
                  disabled={!selectedFolder}
                >
                  New Note
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                {loadingNotes
                  ? <div className="p-4 text-sm text-gray-500">Loading...</div>
                  : <NotesList
                      notes={notes}
                      selectedId={selectedNote?.id}
                      onSelect={setSelectedNote}
                      onDelete={handleDeleteNote}
                    />
                }
              </div>
            </div>

            {/* editor */}
            <div className="rounded-2xl border bg-white p-4 min-h-[320px]">
              {selectedFolder ? (
                selectedNote ? (
                  <NoteForm
                    note={selectedNote?.id ? selectedNote : null}
                    folders={folders}
                    currentFolderId={selectedFolder.id}
                    onSave={handleSaveNote}
                  />
                ) : (
                  <div className="text-sm text-gray-500 p-4">Select or create a note.</div>
                )
              ) : (
                <div className="text-sm text-gray-500 p-4">Create or select a folder to begin.</div>
              )}

              {importing && selectedFolder ? (
                <div className="mt-6 border-t pt-4">
                  <h3 className="font-semibold mb-2">Bulk Import to “{selectedFolder.name}”</h3>
                  <ImportJson onImport={handleImport} />
                </div>
              ) : null}
            </div>
          </div>

          {/* ---------- DESKTOP (lg+) WITH SPLITTER ---------- */}
          <div className="hidden lg:flex lg:h-[calc(100vh-140px)] lg:gap-4">
            {/* fixed sidebar */}
            <aside className="rounded-2xl border bg-white overflow-hidden" style={{ width: SIDEBAR_W }}>
              <FolderList
                folders={folders}
                selectedId={selectedFolder?.id}
                onSelect={(f) => { setSelectedFolder(f); setSidebarOpen(false) }}
                onCreate={handleCreateFolder}
                onRename={handleRenameFolder}
                onDelete={handleDeleteFolder}
              />
            </aside>

            {/* notes + editor with draggable divider */}
            <div ref={containerRef} className="relative flex-1 min-w-0 flex overflow-hidden">
              {/* notes pane */}
              <div
                className="h-full shrink-0 rounded-2xl border bg-white flex flex-col min-w-[200px]"
                style={{ width: notesPaneW }}
              >
                <div className="p-3 border-b flex items-center gap-2">
                  <input
                    className="flex-1 rounded-2xl border px-3 py-2 text-sm"
                    placeholder={`Search in ${selectedFolder?.name || 'folder'}...`}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    disabled={!selectedFolder}
                  />
                  <button
                    onClick={() => setSelectedNote({ folderId: selectedFolder?.id })}
                    className="px-3 py-1.5 border rounded-2xl text-sm"
                    disabled={!selectedFolder}
                  >
                    New Note
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  {loadingNotes
                    ? <div className="p-4 text-sm text-gray-500">Loading...</div>
                    : <NotesList
                        notes={notes}
                        selectedId={selectedNote?.id}
                        onSelect={setSelectedNote}
                        onDelete={handleDeleteNote}
                      />
                  }
                </div>
              </div>

              {/* divider */}
              <div
                role="separator"
                aria-orientation="vertical"
                onMouseDown={onDividerMouseDown}
                className="relative z-10 cursor-col-resize select-none bg-transparent hover:bg-blue-500/20 active:bg-blue-500/30"
                style={{ width: 6 }}
                title="Drag to resize"
              >
                <div className="absolute inset-y-2 left-1/2 -translate-x-1/2 w-px bg-gray-300" />
              </div>

              {/* editor */}
              <div className="min-w-0 flex-1 rounded-2xl border bg-white p-4 overflow-auto">
                {selectedFolder ? (
                  selectedNote ? (
                    <NoteForm
                      note={selectedNote?.id ? selectedNote : null}
                      folders={folders}
                      currentFolderId={selectedFolder.id}
                      onSave={handleSaveNote}
                    />
                  ) : (
                    <div className="text-sm text-gray-500 p-4">Select or create a note.</div>
                  )
                ) : (
                  <div className="text-sm text-gray-500 p-4">Create or select a folder to begin.</div>
                )}

                {importing && selectedFolder ? (
                  <div className="mt-6 border-t pt-4">
                    <h3 className="font-semibold mb-2">Bulk Import to “{selectedFolder.name}”</h3>
                    <ImportJson onImport={handleImport} />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </DndContext>

      {/* MOBILE bottom action bar (fixed) */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 bg-white/95 backdrop-blur border-t">
        <div className="w-full px-3 py-2 flex items-center justify-between">
          <button className="px-3 py-1.5 border rounded-xl" onClick={() => setSidebarOpen(true)}>Folders</button>
          <button
            className="px-3 py-1.5 border rounded-xl"
            onClick={() => setSelectedNote({ folderId: selectedFolder?.id })}
            disabled={!selectedFolder}
          >
            New Note
          </button>
          <button className="px-3 py-1.5 border rounded-xl" onClick={() => setImporting(v => !v)}>Import</button>
        </div>
      </div>
    </div>
  )
}
