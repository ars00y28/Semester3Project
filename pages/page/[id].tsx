import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';

const TiptapEditor = dynamic(() => import('@/components/TiptapEditor'), { ssr: false });
const DatabaseGrid = dynamic(() => import('@/components/DatabaseGrid'), { ssr: false });

interface Props { onRefresh: () => void; }

export default function PageView({ onRefresh }: Props) {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadPage = useCallback(() => {
    if (!id) return;
    fetch(`/api/pages/${id}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setPage(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(false);
    setPage(null);
    loadPage();
  }, [id, loadPage]);

  if (!id || loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  );

  if (error || !page) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-slate-600 font-medium">Page not found</p>
        <p className="text-slate-400 text-sm mt-1">It may have been deleted.</p>
      </div>
    </div>
  );

  return (
    <div className={page.type === 'DATABASE' ? "w-full px-6 sm:px-12 py-8 min-w-0" : "max-w-4xl mx-auto px-10 py-10"}>
      {/* Notion-style Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-400 mb-8 overflow-x-auto whitespace-nowrap">
        <Link href="/" className="hover:text-slate-700 transition-colors">
          ⚙ Workspace
        </Link>
        {page.parent?.parent && (
          <>
            <span>/</span>
            <Link href={`/page/${page.parent.parent.id}`} className="hover:text-slate-700 transition-colors">
              {page.parent.parent.title || 'Untitled'}
            </Link>
          </>
        )}
        {page.parent && (
          <>
            <span>/</span>
            <Link href={`/page/${page.parent.id}`} className="hover:text-slate-700 transition-colors font-medium">
              {page.parent.title || 'Untitled'}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-slate-800 font-semibold truncate max-w-[220px]">
          {page.title || 'Untitled'}
        </span>
      </nav>

      {/* Main Content (Editor or Database) */}
      {page.type === 'DOCUMENT' ? (
        <TiptapEditor
          key={page.id}
          page={page}
          onRefresh={onRefresh}
        />
      ) : (
        <DatabaseGrid key={page.id} page={page} />
      )}
    </div>
  );
}
