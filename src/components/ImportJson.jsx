import { useState } from 'react'

export default function ImportJson({ onImport }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const handleFile = async (file) => {
    const content = await file.text()
    setText(content)
  }

  const parseAndImport = () => {
    setError('')
    try {
      const data = JSON.parse(text)
      onImport(data)
      setText('')
    } catch (e) {
      setError('Invalid JSON: ' + e.message)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="px-3 py-2 border rounded cursor-pointer hover:bg-white">
          Upload JSON file
          <input type="file" accept="application/json" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
        <button onClick={parseAndImport} className="px-3 py-2 border rounded hover:bg-white">Import JSON</button>
      </div>
      <textarea className="w-full rounded-xl border px-3 py-2 min-h-[140px]" placeholder='Paste JSON array here, e.g. [{"title":"A","content":"..."}]' value={text} onChange={e => setText(e.target.value)} />
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </div>
  )
}
