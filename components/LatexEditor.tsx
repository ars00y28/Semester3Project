import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

interface Props {
  page: any;
  onRefresh: () => void;
}

export function LatexEditor({ page, onRefresh }: Props) {
  const [content, setContent] = useState(page.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(Date.now());
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Sync content with server via WebSockets for real-time collab
  useEffect(() => {
    const socket = io({ path: '/api/socket' });
    socket.emit('join-page', page.id);
    
    socket.on('page:content', (data: { content: string }) => {
      setContent(data.content);
      setPreviewKey(Date.now()); // Re-render preview on remote changes
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
    setPreviewKey(Date.now()); // Re-render preview on local save completion
  }, [page.id]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      saveContent(newContent);
    }, 1500); // 1.5s debounce for LaTeX compiling
  };

  const handleManualCompile = () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveContent(content);
  };

  return (
    <div className="flex h-[calc(100vh-140px)] border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Editor Pane */}
      <div className="w-1/2 flex flex-col bg-slate-50 border-r border-slate-200 min-w-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Source Code</span>
          <div className="flex items-center gap-3">
            {isSaving && <span className="text-xs text-blue-500">Saving...</span>}
            <button 
              onClick={handleManualCompile}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors"
            >
              Compile
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
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-300 bg-slate-100">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">PDF Preview</span>
        </div>
        <div className="flex-1 w-full bg-white relative">
          {/* We use a key to force the iframe to reload entirely when previewKey changes */}
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
