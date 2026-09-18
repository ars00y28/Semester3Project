import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import { CreateModal } from './CreateModal';
import { io } from 'socket.io-client';

interface Props {
  pages: any[];
  onRefresh: () => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ pages, onRefresh, isOpen = true, onToggle }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<{ parentId?: string } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Listen for sidebar refresh events from other users
  useEffect(() => {
    const socket = io({ path: '/api/socket' });
    socket.on('sidebar:refresh', () => onRefresh());
    return () => { socket.disconnect(); };
  }, [onRefresh]);

  // Automatically expand parent of currently active page
  useEffect(() => {
    const activeId = router.query.id as string;
    if (!activeId || !pages.length) return;
    const activePage = pages.find(p => p.id === activeId);
    if (activePage?.parentId) {
      setExpanded(prev => ({ ...prev, [activePage.parentId]: true }));
    }
  }, [router.query.id, pages]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [id]: prev[id] === undefined ? false : !prev[id] }));
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this page and all its sub-pages?')) return;
    await fetch(`/api/pages/${id}`, { method: 'DELETE' });
    const socket = io({ path: '/api/socket' });
    socket.emit('page:sidebar-refresh');
    setTimeout(() => socket.disconnect(), 500);
    await onRefresh();
    if (router.query.id === id) router.push('/');
  };

  const handleCreated = useCallback(async (page: any) => {
    setModal(null);
    if (page.parentId) {
      setExpanded(prev => ({ ...prev, [page.parentId]: true }));
    }
    await onRefresh();
    // Notify other users' sidebars
    const socket = io({ path: '/api/socket' });
    socket.emit('page:sidebar-refresh');
    setTimeout(() => socket.disconnect(), 500);
    router.push(`/page/${page.id}`);
  }, [onRefresh, router]);

  const buildTree = (parentId: string | null = null, depth = 0): React.ReactNode => {
    const children = pages.filter(p => (p.parentId ?? null) === parentId);
    if (children.length === 0) return null;

    return children.map(p => {
      const hasChildren = pages.some(c => c.parentId === p.id);
      // Default to expanded (true) unless explicitly collapsed (false)
      const isExpanded = expanded[p.id] !== false;

      return (
        <div key={p.id}>
          <div
            style={{ paddingLeft: `${8 + depth * 14}px` }}
            onMouseEnter={() => setHovered(p.id)}
            onMouseLeave={() => setHovered(null)}
            className={`flex items-center rounded-lg pr-1.5 group transition-colors select-none ${
              router.query.id === p.id
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'hover:bg-slate-200 text-slate-700'
            }`}
          >
            {/* Expand / Collapse toggle chevron */}
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(p.id, e)}
                className="w-4 h-4 flex items-center justify-center text-[10px] text-slate-400 hover:text-slate-700 rounded transition-transform mr-0.5"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            ) : (
              <span className="w-4 h-4 mr-0.5" />
            )}

            {/* Page Link */}
            <Link href={`/page/${p.id}`} className="flex items-center flex-1 py-1.5 text-sm min-w-0">
              <span className="mr-2 text-sm shrink-0">{p.type === 'DATABASE' ? '🗄️' : '📄'}</span>
              <span className="truncate">{p.title || 'Untitled'}</span>
            </Link>

            {/* Hover Actions: + Sub-page and Delete */}
            <div className={`flex items-center shrink-0 gap-0.5 ${hovered === p.id ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
              <button
                type="button"
                title="Add page inside"
                onClick={e => { e.preventDefault(); e.stopPropagation(); setModal({ parentId: p.id }); }}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-300 text-slate-500 hover:text-blue-600 text-xs font-bold"
              >
                +
              </button>
              <button
                type="button"
                title="Delete"
                onClick={e => handleDelete(e, p.id)}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 text-slate-400 hover:text-red-600 text-xs"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Render subpages if expanded */}
          {hasChildren && isExpanded && (
            <div className="border-l border-slate-200 ml-4">
              {buildTree(p.id, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <>
      <aside
        className={`bg-slate-50 h-screen border-r border-slate-200 flex flex-col shrink-0 transition-all duration-300 ease-in-out select-none ${
          isOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 overflow-hidden border-r-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between min-w-[256px]">
          <Link href="/" className="font-bold text-slate-800 text-sm tracking-tight hover:text-blue-600 transition-colors truncate">
            ⚙ Engineering Notion
          </Link>
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              title="Collapse sidebar"
              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded transition-colors text-sm font-semibold ml-1 shrink-0"
            >
              «
            </button>
          )}
        </div>

        {/* New page button */}
        <div className="px-2 py-2 border-b border-slate-100">
          <button
            type="button"
            onClick={() => setModal({})}
            className="flex items-center w-full px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-200 transition-colors font-medium"
          >
            <span className="mr-2 text-base font-bold">+</span>
            New Page
          </button>
        </div>

        {/* Page tree */}
        <div className="flex-1 overflow-y-auto py-1.5 px-2 space-y-0.5">
          {pages.length === 0 ? (
            <p className="text-xs text-slate-400 px-3 py-4 text-center">
              No pages yet.<br/>Click + New Page to start.
            </p>
          ) : (
            buildTree(null)
          )}
        </div>
      </aside>

      {modal !== null && (
        <CreateModal
          parentId={modal.parentId}
          onClose={() => setModal(null)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
