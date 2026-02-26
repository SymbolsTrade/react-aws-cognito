import { useEffect, useMemo, useState, useRef } from 'react'
// Import html2pdf.js via CDN
// You may need to add <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script> to your index.html for this to work
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

export default function NoteForm({ note, folders, currentFolderId, onSave }) {
  const previewRef = useRef(null)
  const [title, setTitle] = useState(note?.title || '')
  const [content, setContent] = useState(note?.content || '')
  const [folderId, setFolderId] = useState(note?.folderId || currentFolderId)
  const [preview, setPreview] = useState(true)

  useEffect(() => {
    setTitle(note?.title || '')
    setContent(note?.content || '')
    setFolderId(note?.folderId || currentFolderId)
    // when switching notes, go back to edit mode so you can type immediately
    setPreview(true)
  }, [note?.id, currentFolderId])

  // Heuristic: does the text look like Markdown?
  const looksLikeMarkdown = useMemo(() => {
    const t = (content || '').trim()
    if (!t) return false
    return /(^|\n)\s{0,3}#{1,6}\s|(^|\n)[*-]\s|(^|\n)\d+\.\s|`{1,3}[^`]|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)/.test(t)
  }, [content])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({ ...note, title, content, folderId })
    setPreview(true) // after saving, show preview so user can see rendered result immediately
  }

  // Export PDF handler
  const handleExportPDF = () => {
    if (previewRef.current) {
      // html2pdf must be loaded globally
      window.html2pdf().from(previewRef.current).set({
        margin: 0.5,
        filename: (title || 'note') + '.pdf',
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
      }).save()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Title + Folder */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium">Title</label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Note title"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Folder</label>
          <select
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={folderId}
            onChange={e => setFolderId(e.target.value)}
          >
            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      </div>

      {/* Toolbar: Markdown hint + Preview toggle */}
      <div className="flex items-center justify-between">
        <div className={`text-xs ${looksLikeMarkdown ? 'text-green-600' : 'text-gray-500'}`}>
          {looksLikeMarkdown ? 'Markdown detected' : 'Plain text'}
        </div>
        <button
          type="button"
          onClick={() => setPreview(p => !p)}
          className="px-3 py-1.5 rounded-2xl border shadow-sm hover:shadow text-sm"
          aria-pressed={preview}
        >
          {preview ? 'Edit' : 'Preview Markdown'}
        </button>
      </div>

      {/* Content: edit OR preview */}
      <div>
        <label className="block text-sm font-medium">Content</label>

        {preview ? (
          <div>
            <div className="mt-1 rounded-xl border p-4 bg-gray-50 overflow-auto" ref={previewRef}>
              <div className="prose max-w-none">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {content || '_(empty note)_'}
                </ReactMarkdown>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportPDF}
              className="mt-2 px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700"
            >
              Export to PDF
            </button>
          </div>
        ) : (
          <textarea
            className="mt-1 w-full rounded-xl border px-3 py-2 h-full min-h-[420px]"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write Markdown or plain text..."
          />
        )}
      </div>

      <div className="pt-2 flex items-center gap-2">
        <button type="submit" /*className="px-4 py-2 rounded-2xl border shadow-sm hover:shadow"*/
        className="mt-3 px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Save
        </button>
        {preview && (
          <button type="button" onClick={() => setPreview(false)} className="px-3 py-1.5 rounded-2xl border">
            Back to Edit
          </button>
        )}
      </div>
    </form>
  )
}
