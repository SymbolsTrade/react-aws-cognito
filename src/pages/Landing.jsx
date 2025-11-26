import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-100">
      <header className="sticky top-0 bg-white/70 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-xl font-semibold tracking-tight">Notes Keeper</div>
          <nav className="flex items-center gap-6 text-sm">
            <Link className="hover:underline" to="/dashboard">Dashboard</Link>
            <Link className="hover:underline" to="/app">Notes</Link>
            <Link to="/dashboard" className="px-3 py-1.5 rounded-2xl border shadow-sm hover:shadow transition">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="py-20" id="hero">
          <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                Organize notes by folders and find anything fast
              </h1>
              <p className="mt-4 text-gray-600">
                Sign in with AWS Cognito, keep notes organized by folders, and track upcoming events. 
                The dashboard shows reminders **1 day ahead** so you’re always ready.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Link to="/dashboard" className="px-5 py-3 rounded-2xl border shadow-sm hover:shadow transition bg-white">
                  Get started — Sign in
                </Link>
                <Link to="/app" className="px-5 py-3 rounded-2xl border hover:shadow transition">
                  Go to Notes
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Highlights</h2>
              <ul className="mt-3 list-disc pl-6 space-y-1 text-gray-700">
                <li>Folder sidebar with per‑folder notes</li>
                <li>Lazy load per folder (no all‑at‑once fetch)</li>
                <li>Dashboard reminders 1 day before events</li>
                <li>Quick add events: title, notes, location, datetime</li>
                <li>Search title/content within the selected folder</li>
                <li>Bulk import JSON into the current folder</li>
                <li>One‑click Markdown preview while editing notes</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-gray-600 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Notes Keeper</span>
          <a className="hover:underline" href="#hero">Back to top</a>
        </div>
      </footer>
    </div>
  )
}
