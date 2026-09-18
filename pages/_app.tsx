import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { Sidebar } from '@/components/Sidebar';
import { useEffect, useState, useCallback } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  const [pages, setPages] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const refreshPages = useCallback(async () => {
    const res = await fetch('/api/pages');
    if (res.ok) setPages(await res.json());
  }, []);

  useEffect(() => {
    refreshPages();
    const saved = localStorage.getItem('notion_sidebar_open');
    if (saved !== null) {
      setSidebarOpen(saved !== 'false');
    }
  }, [refreshPages]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem('notion_sidebar_open', String(next));
      return next;
    });
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-white text-slate-900 antialiased">
      <Sidebar
        pages={pages}
        onRefresh={refreshPages}
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
      />
      <main className="flex-1 overflow-y-auto relative">
        {!sidebarOpen && (
          <button
            type="button"
            onClick={toggleSidebar}
            title="Expand sidebar"
            className="fixed top-3 left-3 z-30 flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow rounded-lg text-slate-600 hover:text-slate-900 transition-all text-xs font-medium"
          >
            <span className="text-sm leading-none">»</span>
            <span className="text-[11px] text-slate-500">Show Sidebar</span>
          </button>
        )}
        <Component {...pageProps} onRefresh={refreshPages} />
      </main>
    </div>
  );
}
