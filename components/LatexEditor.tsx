import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

interface Props {
  page: any;
  onRefresh: () => void;
}

export function LatexEditor({ page, onRefresh }: Props) {
  const [content, setContent] = useState(page.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [previewKey, setPreviewKey] = useState(Date.now());
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Sync content with server via WebSockets for real-time collab
  useEffect(() => {
    const socket = io({ path: '/api/socket' });
    socket.emit('join-page', page.id);
    
    socket.on('page:content', (data: { content: string }) => {
      setContent(data.content);
    });

    return () => { socket.disconnect(); };
  }, [page.id]);

  const saveContent = useCallback(async (newContent: string) => {
    setIsSaving(true);
    await fetch(`/api/pages/${page.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent }),
    });
    
    const socket = io({ path: '/api/socket' });
    socket.emit('page:content', { pageId: page.id, content: newContent });
    setTimeout(() => socket.disconnect(), 500);
    
    setIsSaving(false);
  }, [page.id]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    
    // Autosave in the background, but do NOT compile automatically.
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      saveContent(newContent);
    }, 1500);
  };

  const handleManualCompile = async () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    setIsCompiling(true);
    await saveContent(content);
    setPreviewKey(Date.now());
    setTimeout(() => setIsCompiling(false), 1000); // just to show visual feedback
  };

  return (
    <div className="flex-1 flex w-full border-t border-slate-200 overflow-hidden bg-white">
      {/* Editor Pane */}
      <div className="w-1/2 flex flex-col bg-slate-50 border-r border-slate-200 min-w-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white shrink-0">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Source Code</span>
          <div className="flex items-center gap-3">
            {isSaving && <span className="text-xs text-blue-500">Saving...</span>}
            <button 
              onClick={handleManualCompile}
              disabled={isCompiling}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <span>{isCompiling ? '⏳ Compiling...' : '▶ Compile'}</span>
            </button>
          </div>
        </div>
        <textarea
          value={content}
          onChange={handleContentChange}
          spellCheck={false}
          className="flex-1 w-full p-4 font-mono text-sm leading-relaxed bg-transparent resize-none focus:outline-none focus:ring-inset focus:ring-2 focus:ring-blue-500/50"
          placeholder="% Write your LaTeX here..."
        />
      </div>

      {/* Preview Pane */}
      <div className="w-1/2 flex flex-col bg-slate-200 min-w-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-300 bg-slate-100 shrink-0">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">PDF Preview</span>
          <a
            href={`/api/latex/preview?id=${page.id}&t=${previewKey}`}
            target="_blank"
            download={`document_${page.id}.pdf`}
            className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded transition-colors shadow-sm flex items-center gap-1.5"
            title="Download the compiled PDF file"
          >
            <span>📥</span>
            <span>Download PDF</span>
          </a>
        </div>
        <div className="flex-1 w-full bg-white relative">
          <iframe 
            key={previewKey}
            src={`/api/latex/preview?id=${page.id}&t=${previewKey}`} 
            className="absolute inset-0 w-full h-full border-0"
            title="PDF Preview"
          />
        </div>
      </div>
    </div>
  );
}
