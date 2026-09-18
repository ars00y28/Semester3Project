import { useEffect, useRef, useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { common, createLowlight } from 'lowlight';
import { useRouter } from 'next/router';
import { CreateModal } from './CreateModal';
import { PageLink } from './PageLinkExtension';
import { DatabaseBlock } from './DatabaseBlockExtension';
import { io, Socket } from 'socket.io-client';

const lowlight = createLowlight(common);

const COMMANDS = [
  { label: 'Heading 1', icon: 'H1', desc: 'Large section heading', action: (e: any) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'Heading 2', icon: 'H2', desc: 'Medium section heading', action: (e: any) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Heading 3', icon: 'H3', desc: 'Small section heading', action: (e: any) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: 'Bullet List', icon: '•—', desc: 'Create a simple bullet list', action: (e: any) => e.chain().focus().toggleBulletList().run() },
  { label: 'Numbered List', icon: '1.', desc: 'Create a numbered list', action: (e: any) => e.chain().focus().toggleOrderedList().run() },
  { label: 'Code Block', icon: '<>', desc: 'Write code with syntax highlighting', action: (e: any) => e.chain().focus().toggleCodeBlock().run() },
  { label: 'Quote', icon: '❝', desc: 'Capture a quote or callout', action: (e: any) => e.chain().focus().toggleBlockquote().run() },
  { label: 'Divider', icon: '—', desc: 'Add a horizontal line', action: (e: any) => e.chain().focus().setHorizontalRule().run() },
  {
    label: 'Table',
    icon: '📊',
    desc: 'Insert an editable 3x3 table',
    action: (e: any) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    label: 'Database',
    icon: '🗄️',
    desc: 'Insert an inline database table with typed columns',
    action: (_e: any, ctx: any) => {
      if (ctx?.insertDatabase) ctx.insertDatabase();
    },
  },
  {
    label: 'Sub-page',
    icon: '📄',
    desc: 'Insert a sub-page on this line',
    action: (_e: any, ctx: any) => {
      if (ctx?.openSubpageModal) ctx.openSubpageModal();
    },
  },
  {
    label: 'Image', icon: '🖼', desc: 'Upload an image from your device',
    action: (e: any) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => e.chain().focus().setImage({ src: ev.target?.result }).run();
        reader.readAsDataURL(file);
      };
      input.click();
    }
  },
];

interface Props { page: any; onRefresh?: () => void; }

export default function TiptapEditor({ page, onRefresh }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(page.title || '');
  const [slashMenu, setSlashMenu] = useState<{ x: number; y: number; query: string } | null>(null);
  const [showSubpageModal, setShowSubpageModal] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const isReceiving = useRef(false);
  const saveTimer = useRef<any>(null);

  const handleSubpageCreated = (newPage: any) => {
    setShowSubpageModal(false);
    if (editor) {
      editor
        .chain()
        .focus()
        .insertContent([
          {
            type: 'pageLink',
            attrs: {
              pageId: newPage.id,
              title: newPage.title,
              pageType: newPage.type,
            },
          },
          {
            type: 'text',
            text: ' ',
          },
        ])
        .run();
    }
    if (onRefresh) onRefresh();
    const socket = io({ path: '/api/socket' });
    socket.emit('page:sidebar-refresh');
    setTimeout(() => socket.disconnect(), 500);
  };

  const insertDatabase = async () => {
    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Tasks Database',
          type: 'DATABASE',
          parentId: page.id,
        }),
      });
      const dbPage = await res.json();
      if (editor) {
        editor
          .chain()
          .focus()
          .insertContent([
            {
              type: 'databaseBlock',
              attrs: {
                databaseId: dbPage.id,
                title: dbPage.title,
              },
            },
            {
              type: 'paragraph',
            },
          ])
          .run();
      }
      if (onRefresh) onRefresh();
      const socket = io({ path: '/api/socket' });
      socket.emit('page:sidebar-refresh');
      setTimeout(() => socket.disconnect(), 500);
    } catch (err) {
      console.error('Failed to create inline database', err);
    }
  };

  const saveContent = useCallback(async (content: string) => {
    await fetch(`/api/pages/${page.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  }, [page.id]);

  const saveTitle = useCallback(async (t: string) => {
    await fetch(`/api/pages/${page.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: t }),
    });
    socketRef.current?.emit('page:title', { pageId: page.id, title: t });
    socketRef.current?.emit('page:sidebar-refresh');
    if (onRefresh) onRefresh();
  }, [page.id, onRefresh]);

  let initialContent: any = undefined;
  try { if (page.content) initialContent = JSON.parse(page.content); } catch {}

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder: "Type '/' for commands, or start writing…" }),
      Underline,
      TextStyle,
      Color,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      PageLink,
      DatabaseBlock,
    ],
    content: initialContent || '',
    onUpdate: ({ editor }) => {
      if (isReceiving.current) return;
      const json = editor.getJSON();

      // Slash command detection
      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 40), from);
      const slashMatch = textBefore.match(/\/(\w*)$/);
      if (slashMatch) {
        try {
          const coords = editor.view.coordsAtPos(from);
          const menuHeight = 300;
          const isNearBottom = coords.bottom + menuHeight > window.innerHeight;
          const y = isNearBottom
            ? Math.max(10, coords.top - menuHeight - 10)
            : coords.bottom + 6;
          const x = Math.min(Math.max(16, coords.left), window.innerWidth - 280);
          setSlashMenu({ x, y, query: slashMatch[1] });
        } catch { setSlashMenu(null); }
      } else {
        setSlashMenu(null);
      }

      // Debounced save + broadcast
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const str = JSON.stringify(json);
        saveContent(str);
        socketRef.current?.emit('page:content', { pageId: page.id, content: str });
      }, 600);
    },
  });

  // Socket.io realtime
  useEffect(() => {
    const socket = io({ path: '/api/socket' });
    socketRef.current = socket;
    socket.emit('join-page', page.id);

    socket.on('page:content', ({ content }: { content: string }) => {
      if (!editor) return;
      isReceiving.current = true;
      try { editor.commands.setContent(JSON.parse(content), { emitUpdate: false }); }
      finally { setTimeout(() => { isReceiving.current = false; }, 100); }
    });

    socket.on('page:title', ({ title: t }: { title: string }) => setTitle(t));
    return () => { socket.disconnect(); };
  }, [page.id, editor]);

  const applyCommand = (cmd: typeof COMMANDS[0]) => {
    if (!editor) return;
    setSlashMenu(null);
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 40), from);
    const m = textBefore.match(/\/(\w*)$/);
    if (m) editor.chain().deleteRange({ from: from - m[0].length, to: from }).run();
    cmd.action(editor, {
      openSubpageModal: () => setShowSubpageModal(true),
      insertDatabase,
    });
  };

  const filtered = slashMenu ? COMMANDS.filter(c => c.label.toLowerCase().includes(slashMenu.query.toLowerCase())) : [];

  if (!editor) return <div className="p-8 text-slate-400 animate-pulse">Loading editor…</div>;

  return (
    <div className="relative min-h-full" onClick={() => setSlashMenu(null)}>
      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={e => {
          setTitle(e.target.value);
          socketRef.current?.emit('page:title', { pageId: page.id, title: e.target.value });
        }}
        onBlur={() => saveTitle(title)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); editor.commands.focus('start'); } }}
        placeholder="Untitled"
        className="w-full text-4xl font-bold text-slate-900 border-none outline-none bg-transparent mb-2 placeholder:text-slate-300"
      />

      {/* Sticky formatting toolbar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-1 bg-white/95 backdrop-blur border border-slate-200 rounded-xl p-1.5 mb-6 shadow-sm">
        {[
          { lbl: 'B', title: 'Bold', fn: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), cls: 'font-bold' },
          { lbl: 'I', title: 'Italic', fn: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), cls: 'italic' },
          { lbl: 'U', title: 'Underline', fn: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline'), cls: 'underline' },
          { lbl: 'S', title: 'Strikethrough', fn: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike'), cls: 'line-through' },
          { lbl: '`code`', title: 'Inline Code', fn: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code'), cls: 'font-mono text-xs' },
        ].map(btn => (
          <button
            key={btn.lbl}
            type="button"
            title={btn.title}
            onMouseDown={e => { e.preventDefault(); btn.fn(); }}
            className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${btn.cls} ${btn.active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {btn.lbl}
          </button>
        ))}

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {[
          { lbl: 'H1', title: 'Heading 1', fn: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }) },
          { lbl: 'H2', title: 'Heading 2', fn: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
          { lbl: 'H3', title: 'Heading 3', fn: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
          { lbl: '• List', title: 'Bullet List', fn: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
          { lbl: '1. List', title: 'Numbered List', fn: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
          { lbl: '❝ Quote', title: 'Quote', fn: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
          { lbl: '<> Block', title: 'Code Block', fn: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock') },
        ].map(btn => (
          <button
            key={btn.lbl}
            type="button"
            title={btn.title}
            onMouseDown={e => { e.preventDefault(); btn.fn(); }}
            className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${btn.active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {btn.lbl}
          </button>
        ))}

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <button
          type="button"
          title="Upload image"
          onMouseDown={e => {
            e.preventDefault();
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = () => {
              const file = input.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                editor.chain().focus().setImage({ src: ev.target?.result as string }).run();
              };
              reader.readAsDataURL(file);
            };
            input.click();
          }}
          className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          🖼️ Image
        </button>

        <button
          type="button"
          title="Insert table"
          onMouseDown={e => {
            e.preventDefault();
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
          }}
          className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          📊 Table
        </button>

        <button
          type="button"
          title="Insert an inline database table with typed columns"
          onMouseDown={e => { e.preventDefault(); insertDatabase(); }}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
        >
          🗄️ Database
        </button>

        <button
          type="button"
          title="Insert a sub-page on this line"
          onMouseDown={e => { e.preventDefault(); setShowSubpageModal(true); }}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
        >
          + Sub-page
        </button>

        <button
          type="button"
          title="Insert horizontal divider"
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().setHorizontalRule().run(); }}
          className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          — Line
        </button>

        {editor.isActive('table') && (
          <>
            <div className="w-px h-5 bg-slate-200 mx-1" />
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().addRowAfter().run(); }}
              className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              + Row
            </button>
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().addColumnAfter().run(); }}
              className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              + Col
            </button>
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().deleteRow().run(); }}
              className="px-2 py-0.5 rounded text-[11px] bg-red-50 text-red-600 hover:bg-red-100"
            >
              ✕ Row
            </button>
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().deleteColumn().run(); }}
              className="px-2 py-0.5 rounded text-[11px] bg-red-50 text-red-600 hover:bg-red-100"
            >
              ✕ Col
            </button>
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().deleteTable().run(); }}
              className="px-2 py-0.5 rounded text-[11px] bg-red-100 text-red-700 hover:bg-red-200"
            >
              Delete Table
            </button>
          </>
        )}
      </div>

      {/* Editor content area */}
      <EditorContent
        editor={editor}
        className="
          [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[60vh]
          [&_.ProseMirror_h1]:text-3xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mt-8 [&_.ProseMirror_h1]:mb-3 [&_.ProseMirror_h1]:text-slate-900
          [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mt-7 [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h2]:text-slate-800
          [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mt-5 [&_.ProseMirror_h3]:mb-1.5 [&_.ProseMirror_h3]:text-slate-700
          [&_.ProseMirror_p]:my-1.5 [&_.ProseMirror_p]:text-slate-700 [&_.ProseMirror_p]:leading-7
          [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul]:text-slate-700
          [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol]:text-slate-700
          [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-blue-300 [&_.ProseMirror_blockquote]:pl-5 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:text-slate-500 [&_.ProseMirror_blockquote]:my-4 [&_.ProseMirror_blockquote]:bg-blue-50 [&_.ProseMirror_blockquote]:py-2 [&_.ProseMirror_blockquote]:rounded-r-lg
          [&_.ProseMirror_pre]:bg-slate-900 [&_.ProseMirror_pre]:text-slate-100 [&_.ProseMirror_pre]:rounded-xl [&_.ProseMirror_pre]:p-5 [&_.ProseMirror_pre]:my-4 [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:text-sm [&_.ProseMirror_pre]:leading-relaxed
          [&_.ProseMirror_code]:bg-slate-100 [&_.ProseMirror_code]:text-red-600 [&_.ProseMirror_code]:px-1.5 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:text-sm [&_.ProseMirror_code]:font-mono
          [&_.ProseMirror_img]:rounded-xl [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:my-5 [&_.ProseMirror_img]:shadow-lg [&_.ProseMirror_img]:border [&_.ProseMirror_img]:border-slate-100
          [&_.ProseMirror_hr]:border-0 [&_.ProseMirror_hr]:border-t [&_.ProseMirror_hr]:border-slate-200 [&_.ProseMirror_hr]:my-8
          [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:my-6 [&_.ProseMirror_table]:border [&_.ProseMirror_table]:border-slate-200 [&_.ProseMirror_table]:rounded-xl [&_.ProseMirror_table]:overflow-hidden [&_.ProseMirror_table]:shadow-sm
          [&_.ProseMirror_th]:bg-slate-100 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-slate-200 [&_.ProseMirror_th]:p-3 [&_.ProseMirror_th]:text-left [&_.ProseMirror_th]:font-semibold [&_.ProseMirror_th]:text-slate-700
          [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-slate-200 [&_.ProseMirror_td]:p-3 [&_.ProseMirror_td]:text-slate-800
          [&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_.is-editor-empty:first-child::before]:text-slate-300 [&_.ProseMirror_.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_.is-editor-empty:first-child::before]:h-0
        "
        onClick={e => {
          e.stopPropagation();
          const link = (e.target as HTMLElement).closest('[data-page-id]');
          if (link) {
            e.preventDefault();
            const targetId = link.getAttribute('data-page-id');
            if (targetId) router.push(`/page/${targetId}`);
          } else {
            editor.commands.focus();
          }
        }}
      />

      {/* Slash command popup */}
      {slashMenu && filtered.length > 0 && (
        <div
          className="fixed z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl w-64 max-h-[290px] overflow-y-auto py-1"
          style={{ left: slashMenu.x, top: slashMenu.y }}
          onMouseDown={e => e.preventDefault()}
          onClick={e => e.stopPropagation()}
        >
          <p className="px-4 pt-2 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Basic blocks</p>
          {filtered.map((cmd, i) => (
            <button
              key={i}
              onMouseDown={e => { e.preventDefault(); applyCommand(cmd); }}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-left hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <span className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg font-mono text-xs font-bold shrink-0">
                {cmd.icon}
              </span>
              <div>
                <div className="font-medium">{cmd.label}</div>
                <div className="text-xs text-slate-400">{cmd.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Sub-page creation modal */}
      {showSubpageModal && (
        <CreateModal
          parentId={page.id}
          onClose={() => setShowSubpageModal(false)}
          onCreated={handleSubpageCreated}
        />
      )}
    </div>
  );
}
