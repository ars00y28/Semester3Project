import { NodeViewWrapper } from '@tiptap/react';
import { useEffect, useState } from 'react';
import DatabaseGrid from './DatabaseGrid';

export default function DatabaseNodeView({ node, deleteNode }: any) {
  const databaseId = node.attrs.databaseId;
  const [dbPage, setDbPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!databaseId) return;
    fetch(`/api/pages/${databaseId}`)
      .then(r => r.json())
      .then(data => {
        setDbPage(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [databaseId]);

  return (
    <NodeViewWrapper className="database-node-view my-6" contentEditable={false}>
      {loading ? (
        <div className="p-8 border border-slate-200 rounded-2xl bg-slate-50 text-xs text-slate-400 text-center animate-pulse">
          Loading inline database…
        </div>
      ) : dbPage ? (
        <DatabaseGrid page={dbPage} isEmbedded={true} onDeleteDatabase={() => deleteNode?.()} />
      ) : (
        <div className="p-4 border border-dashed border-red-200 rounded-xl bg-red-50 text-xs text-red-500 text-center">
          Database not found or deleted.
        </div>
      )}
    </NodeViewWrapper>
  );
}
