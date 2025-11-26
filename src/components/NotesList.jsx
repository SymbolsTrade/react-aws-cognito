import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableNoteItem({ note, selectedId, onSelect, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: `note:${note.id}`,
      data: { type: 'note', noteId: note.id, folderId: note.folderId }
    })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners}
        className={"p-3 cursor-pointer " + (selectedId === note.id ? "bg-blue-50" : "hover:bg-gray-50")}>
      <div className="flex items-start justify-between" onClick={() => onSelect(note)}>
        <div>
          <div className="font-medium">{note.title}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {(note.content || '').slice(0, 120)}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(note.id) }}
          className="text-xs px-2 py-1 border rounded hover:bg-white"
        >
          Delete
        </button>
      </div>
    </li>
  )
}

export default function NotesList({ notes, selectedId, onSelect, onDelete }) {
  const ids = notes.map(n => `note:${n.id}`)
  return (
    <div className="overflow-y-auto">
      {notes.length === 0 ? (
        <div className="p-4 text-sm text-gray-500">No notes in this folder.</div>
      ) : (
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="divide-y">
            {notes.map(n => (
              <SortableNoteItem
                key={n.id}
                note={n}
                selectedId={selectedId}
                onSelect={onSelect}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </SortableContext>
      )}
    </div>
  )
}
