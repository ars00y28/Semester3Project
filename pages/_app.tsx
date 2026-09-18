import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { Sidebar } from '@/components/Sidebar';
import { useEffect, useState, useCallback } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  const [pages, setPages] = useState<any[]>([]);

  const refreshPages = useCallback(async () => {
    const res = await fetch('/api/pages');
    if (res.ok) setPages(await res.json());
  }, []);

  useEffect(() => { refreshPages(); }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-white text-slate-900 antialiased">
      <Sidebar pages={pages} onRefresh={refreshPages} />
      <main className="flex-1 overflow-y-auto">
        <Component {...pageProps} onRefresh={refreshPages} />
      </main>
    </div>
  );
}
