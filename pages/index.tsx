export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-12">
      <div className="text-7xl mb-6">⚙️</div>
      <h1 className="text-3xl font-bold text-slate-800 mb-3">Engineering Notion</h1>
      <p className="text-slate-500 max-w-sm leading-relaxed">
        Select a page from the sidebar, or click{' '}
        <span className="font-semibold text-slate-700">+ New Page</span>{' '}
        to create a Document or Database.
      </p>
      <div className="mt-10 grid grid-cols-2 gap-4 text-sm text-slate-500 max-w-md">
        {[
          { icon: '📄', label: 'Document', desc: 'Write with headings, code, images & more' },
          { icon: '🗄️', label: 'Database', desc: 'Track tasks in a structured table' },
          { icon: '🔗', label: 'Share', desc: 'Anyone with the link can collaborate' },
          { icon: '⚡', label: 'Real-time', desc: 'Changes sync instantly across all users' },
        ].map(f => (
          <div key={f.label} className="bg-slate-50 rounded-xl p-4 text-left border border-slate-100">
            <div className="text-2xl mb-1">{f.icon}</div>
            <div className="font-semibold text-slate-700 mb-0.5">{f.label}</div>
            <div className="text-xs text-slate-400">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
