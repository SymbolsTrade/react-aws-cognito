import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'

function DroppableRow({ folder, selected, onSelect, onRename, onDelete }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `folder:${folder.id}`,
    data: { type: 'folder', folderId: folder.id }
  })
  return (
    <li
      ref={setNodeRef}
      className={
        "px-3 py-2 cursor-pointer flex items-center justify-between " +
        (selected ? "bg-blue-50 " : "hover:bg-gray-50 ") +
        (isOver ? "ring-2 ring-blue-300" : "")
      }
      onClick={() => onSelect(folder)}
    >
      <div className="truncate">{folder.name}</div>
      <div className="flex items-center gap-1">
        <button
          className="text-[11px] px-2 py-0.5 border rounded bg-white"
          onClick={(e) => { e.stopPropagation(); const name = prompt('Rename folder', folder.name); if (name != null) onRename(folder.id, name) }}
        >
          Rename
        </button>
        <button
          className="text-[11px] px-2 py-0.5 border rounded bg-white"
          onClick={(e) => { e.stopPropagation(); if (confirm('Delete this folder and its notes?')) onDelete(folder.id) }}
        >
          Delete
        </button>
      </div>
    </li>
  )
}

export default function FolderList({ folders, selectedId, onSelect, onCreate, onRename, onDelete }) {
  const [newName, setNewName] = useState('')
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <form
          onSubmit={(e) => { e.preventDefault(); if (newName.trim()) { onCreate(newName); setNewName('') } }}
          className="flex gap-2"
        >
          <input
            className="flex-1 rounded-xl border px-2 py-1 text-sm"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New folder name"
          />
          <button className="text-sm px-3 py-1 border rounded">Add</button>
        </form>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y">
          {folders.map(f => (
            <DroppableRow
              key={f.id}
              folder={f}
              selected={selectedId === f.id}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}
