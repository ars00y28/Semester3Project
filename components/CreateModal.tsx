import { useState } from 'react';

interface Props {
  parentId?: string;
  onClose: () => void;
  onCreated: (page: any) => void;
}

export function CreateModal({ parentId, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'DOCUMENT' | 'DATABASE' | 'LATEX'>('DOCUMENT');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), type, parentId }),
      });
      const page = await res.json();
      onCreated(page);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[480px] p-7"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-slate-800 mb-1">Create New Page</h2>
        <p className="text-sm text-slate-500 mb-5">
          {parentId ? 'Will be nested inside the current page.' : 'Top-level page in your workspace.'}
        </p>

        {/* Type selector */}
        <div className="flex gap-2 mb-5">
          {(['DOCUMENT', 'DATABASE', 'LATEX'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-3 px-1 rounded-xl text-sm font-semibold border-2 transition-all ${
                type === t
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {t === 'DOCUMENT' ? '📄 Document' : t === 'DATABASE' ? '🗄️ Database' : '🧮 LaTeX'}
            </button>
          ))}
        </div>

        <input
          autoFocus
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleCreate();
            if (e.key === 'Escape') onClose();
          }}
          placeholder={type === 'DOCUMENT' ? 'e.g. Project Overview' : 'e.g. Sprint Tracker'}
          className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || loading}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
