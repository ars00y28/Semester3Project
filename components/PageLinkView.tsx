import { NodeViewWrapper } from '@tiptap/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export default function PageLinkView({ node, deleteNode }: any) {
  const router = useRouter();
  const pageId = node.attrs.pageId;
  const [pageInfo, setPageInfo] = useState<{ title: string; type: string }>({
    title: node.attrs.title || 'Untitled',
    type: node.attrs.pageType || 'DOCUMENT',
  });

  useEffect(() => {
    if (!pageId) return;

    // Fetch the latest title & type from the server so renames are always reflected
    fetch(`/api/pages/${pageId}`)
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(data => {
        if (data?.title) {
          setPageInfo({ title: data.title, type: data.type || 'DOCUMENT' });
        }
      })
      .catch(() => {});

    // Listen for live title changes via Socket.io
    const socket = io({ path: '/api/socket' });
    socket.emit('join-page', pageId);
    socket.on('page:title', ({ title }: { title: string }) => {
      if (title) setPageInfo(prev => ({ ...prev, title }));
    });

    return () => {
      socket.disconnect();
    };
  }, [pageId]);

  const handleDeleteSubpage = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete sub-page "${pageInfo.title}" and remove it from navigation?`)) return;
    await fetch(`/api/pages/${pageId}`, { method: 'DELETE' });
    const socket = io({ path: '/api/socket' });
    socket.emit('page:sidebar-refresh');
    setTimeout(() => socket.disconnect(), 500);
    if (deleteNode) deleteNode();
  };

  const icon = pageInfo.type === 'DATABASE' ? '🗄️' : '📄';

  return (
    <NodeViewWrapper
      as="span"
      className="inline-block align-middle my-0.5 mx-1"
      contentEditable={false}
    >
      <span
        data-page-id={pageId}
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 text-slate-800 hover:text-blue-700 font-medium text-sm border border-slate-200 hover:border-blue-300 transition-colors select-none text-left group/subpage"
      >
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (pageId) {
              router.push(`/page/${pageId}`);
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 outline-none cursor-pointer"
        >
          <span className="text-sm shrink-0">{icon}</span>
          <span className="truncate max-w-[220px]">{pageInfo.title}</span>
        </button>
        <button
          type="button"
          onClick={handleDeleteSubpage}
          onMouseDown={(e) => e.stopPropagation()}
          title="Delete sub-page and remove from navigation"
          className="w-4 h-4 flex items-center justify-center rounded-full text-slate-400 hover:text-red-600 hover:bg-red-100 opacity-0 group-hover/subpage:opacity-100 transition-all text-xs font-bold shrink-0 ml-0.5"
        >
          ✕
        </button>
      </span>
    </NodeViewWrapper>
  );
}
