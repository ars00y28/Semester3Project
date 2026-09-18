import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { io, Socket } from 'socket.io-client';

export type ColumnType = 'TEXT' | 'STATUS' | 'DATE' | 'NUMBER';

export const COLUMN_TYPE_META: Record<ColumnType, { label: string; icon: string }> = {
  TEXT: { label: 'Text', icon: '📝' },
  STATUS: { label: 'Status', icon: '🏷️' },
  DATE: { label: 'Date', icon: '📅' },
  NUMBER: { label: 'Number', icon: '🔢' },
};

export type NumberFormat = 'number' | 'dollar' | 'euro' | 'pound' | 'rupee' | 'percent';

export const NUMBER_FORMAT_META: Record<NumberFormat, { label: string; icon: string; symbol: string }> = {
  number: { label: 'Number', icon: '🔢', symbol: '' },
  dollar: { label: 'US Dollar ($)', icon: '💲', symbol: '$' },
  euro: { label: 'Euro (€)', icon: '💶', symbol: '€' },
  pound: { label: 'Pound (£)', icon: '💷', symbol: '£' },
  rupee: { label: 'Rupee (₹)', icon: '₹', symbol: '₹' },
  percent: { label: 'Percent (%)', icon: '٪', symbol: '%' },
};

export type StatusColor = 'slate' | 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'cyan';

export interface StatusItem {
  id: string;
  name: string;
  color: StatusColor;
}

export const STATUS_COLORS: Record<StatusColor, { bg: string; text: string; border: string; dot: string }> = {
  slate: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
};

export const DEFAULT_STATUSES: StatusItem[] = [
  { id: 'not-started', name: 'Not Started', color: 'slate' },
  { id: 'in-progress', name: 'In Progress', color: 'blue' },
  { id: 'done', name: 'Done', color: 'emerald' },
  { id: 'review', name: 'Review', color: 'purple' },
  { id: 'blocked', name: 'Blocked', color: 'rose' },
];

export function formatNumberValue(val: string | number, format: NumberFormat = 'number'): string {
  if (val === '' || val === null || val === undefined) return '';
  const num = parseFloat(String(val));
  if (isNaN(num)) return String(val);

  switch (format) {
    case 'dollar':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
    case 'euro':
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(num);
    case 'pound':
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(num);
    case 'rupee':
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(num);
    case 'percent':
      return `${num}%`;
    default:
      return new Intl.NumberFormat('en-US').format(num);
  }
}

interface Props {
  page: any;
  isEmbedded?: boolean;
}

export default function DatabaseGrid({ page, isEmbedded = false }: Props) {
  const router = useRouter();
  const [columns, setColumns] = useState<any[]>(page.columns || []);
  const [rows, setRows] = useState<any[]>(page.rows || []);
  const [title, setTitle] = useState(page.title || '');
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [activeColMenu, setActiveColMenu] = useState<string | null>(null);
  const [editingColName, setEditingColName] = useState<{ id: string; name: string } | null>(null);
  const [statusPicker, setStatusPicker] = useState<{
    rowId: string;
    colId: string;
    position?: { top: number; left: number; openUpwards: boolean };
  } | null>(null);
  const [editingStatus, setEditingStatus] = useState<{ id: string; name: string; color: StatusColor } | null>(null);
  const [isAddingStatus, setIsAddingStatus] = useState(false);
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState<StatusColor>('blue');
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<ColumnType>('TEXT');
  const [newColNumberFormat, setNewColNumberFormat] = useState<NumberFormat>('number');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!statusPicker) return;
    const handleScroll = () => setStatusPicker(null);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [statusPicker]);

  useEffect(() => {
    const socket = io({ path: '/api/socket' });
    socketRef.current = socket;
    socket.emit('join-page', page.id);

    socket.on('db:column-add', ({ column }: any) => setColumns(prev => [...prev, column]));
    socket.on('db:column-update', ({ column }: any) => {
      setColumns(prev => prev.map(c => c.id === column.id ? column : c));
    });
    socket.on('db:column-delete', ({ columnId }: any) => {
      setColumns(prev => prev.filter(c => c.id !== columnId));
    });

    socket.on('db:row-add', ({ row }: any) => setRows(prev => [...prev, row]));
    socket.on('db:row-delete', ({ rowId }: any) => setRows(prev => prev.filter(r => r.id !== rowId)));

    socket.on('db:cell-update', ({ rowId, columnId, value }: any) => {
      setRows(prev => prev.map(r => {
        if (r.id !== rowId) return r;
        const cells = [...(r.cells || [])];
        const idx = cells.findIndex((c: any) => c.columnId === columnId);
        if (idx >= 0) cells[idx] = { ...cells[idx], value };
        else cells.push({ rowId, columnId, value });
        return { ...r, cells };
      }));
    });

    return () => { socket.disconnect(); };
  }, [page.id]);

  const parseColOptions = useCallback((col: any): { statuses?: StatusItem[]; numberFormat?: NumberFormat } => {
    if (!col?.options) return {};
    if (typeof col.options === 'object') return col.options;
    try {
      return JSON.parse(col.options);
    } catch {
      return {};
    }
  }, []);

  const getColStatuses = useCallback((col: any): StatusItem[] => {
    const opts = parseColOptions(col);
    if (opts.statuses && Array.isArray(opts.statuses) && opts.statuses.length > 0) {
      return opts.statuses;
    }
    return DEFAULT_STATUSES;
  }, [parseColOptions]);

  const updateColumnOptions = async (columnId: string, newOptions: any) => {
    const col = columns.find(c => c.id === columnId);
    if (!col) return;
    const updated = { ...col, options: JSON.stringify(newOptions) };
    setColumns(prev => prev.map(c => c.id === columnId ? updated : c));
    await fetch('/api/databases/columns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: columnId, options: newOptions }),
    });
    socketRef.current?.emit('db:column-update', { pageId: page.id, column: updated });
  };

  const addColumn = async () => {
    if (!newColName.trim()) return;
    const initialOptions: any = {};
    if (newColType === 'NUMBER') {
      initialOptions.numberFormat = newColNumberFormat;
    } else if (newColType === 'STATUS') {
      initialOptions.statuses = DEFAULT_STATUSES;
    }

    const res = await fetch('/api/databases/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageId: page.id,
        name: newColName.trim(),
        type: newColType,
        options: initialOptions,
      }),
    });
    const col = await res.json();
    setColumns(prev => [...prev, col]);
    socketRef.current?.emit('db:column-add', { pageId: page.id, column: col });
    setAddingCol(false);
    setNewColName('');
    setNewColType('TEXT');
    setNewColNumberFormat('number');
  };

  const updateColumnType = async (columnId: string, type: ColumnType) => {
    setActiveColMenu(null);
    const col = columns.find(c => c.id === columnId);
    if (!col) return;
    const existingOpts = parseColOptions(col);
    const updatedOpts = { ...existingOpts };
    if (type === 'NUMBER' && !updatedOpts.numberFormat) {
      updatedOpts.numberFormat = 'number';
    } else if (type === 'STATUS' && (!updatedOpts.statuses || !updatedOpts.statuses.length)) {
      updatedOpts.statuses = DEFAULT_STATUSES;
    }

    const updated = { ...col, type, options: JSON.stringify(updatedOpts) };
    setColumns(prev => prev.map(c => c.id === columnId ? updated : c));
    await fetch('/api/databases/columns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: columnId, type, options: updatedOpts }),
    });
    socketRef.current?.emit('db:column-update', { pageId: page.id, column: updated });
  };

  const updateColumnName = async (columnId: string, name: string) => {
    setEditingColName(null);
    if (!name.trim()) return;
    const col = columns.find(c => c.id === columnId);
    if (!col) return;
    const updated = { ...col, name: name.trim() };
    setColumns(prev => prev.map(c => c.id === columnId ? updated : c));
    await fetch('/api/databases/columns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: columnId, name: name.trim() }),
    });
    socketRef.current?.emit('db:column-update', { pageId: page.id, column: updated });
  };

  const deleteColumn = async (columnId: string) => {
    setActiveColMenu(null);
    if (!confirm('Delete this column and its data?')) return;
    setColumns(prev => prev.filter(c => c.id !== columnId));
    await fetch('/api/databases/columns', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: columnId }),
    });
    socketRef.current?.emit('db:column-delete', { pageId: page.id, columnId });
  };

  const addRow = async () => {
    const res = await fetch('/api/databases/rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId: page.id }),
    });
    const row = await res.json();
    setRows(prev => [...prev, row]);
    socketRef.current?.emit('db:row-add', { pageId: page.id, row });
  };

  const deleteRow = async (rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
    await fetch('/api/databases/rows', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rowId }),
    });
    socketRef.current?.emit('db:row-delete', { pageId: page.id, rowId });
  };

  const updateCell = useCallback(async (rowId: string, columnId: string, value: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const cells = [...(r.cells || [])];
      const idx = cells.findIndex((c: any) => c.columnId === columnId);
      if (idx >= 0) cells[idx] = { ...cells[idx], value };
      else cells.push({ rowId, columnId, value });
      return { ...r, cells };
    }));
    await fetch('/api/databases/cells', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowId, columnId, value }),
    });
    socketRef.current?.emit('db:cell-update', { pageId: page.id, rowId, columnId, value });
  }, [page.id]);

  const handleAddStatusOption = (col: any) => {
    if (!newStatusName.trim()) return;
    const currentStatuses = getColStatuses(col);
    const newItem: StatusItem = {
      id: 'st-' + Date.now(),
      name: newStatusName.trim(),
      color: newStatusColor,
    };
    const newStatuses = [...currentStatuses, newItem];
    const opts = parseColOptions(col);
    updateColumnOptions(col.id, { ...opts, statuses: newStatuses });
    setNewStatusName('');
    setIsAddingStatus(false);
  };

  const handleSaveStatusEdit = (col: any) => {
    if (!editingStatus || !editingStatus.name.trim()) return;
    const currentStatuses = getColStatuses(col);
    const newStatuses = currentStatuses.map(s =>
      s.id === editingStatus.id ? { ...s, name: editingStatus.name.trim(), color: editingStatus.color } : s
    );
    const opts = parseColOptions(col);
    updateColumnOptions(col.id, { ...opts, statuses: newStatuses });
    setEditingStatus(null);
  };

  const handleDeleteStatusOption = (col: any, statusId: string) => {
    const currentStatuses = getColStatuses(col);
    const newStatuses = currentStatuses.filter(s => s.id !== statusId);
    const opts = parseColOptions(col);
    updateColumnOptions(col.id, { ...opts, statuses: newStatuses });
    if (editingStatus?.id === statusId) {
      setEditingStatus(null);
    }
  };

  const getCellValue = (row: any, columnId: string) =>
    row.cells?.find((c: any) => c.columnId === columnId)?.value || '';

  const getStatusColor = (val: string, col: any) => {
    if (!val) return STATUS_COLORS.slate;
    const statuses = getColStatuses(col);
    const found = statuses.find(s => s.name.toLowerCase() === val.toLowerCase());
    if (found && STATUS_COLORS[found.color]) {
      return STATUS_COLORS[found.color];
    }
    const legacyMap: Record<string, StatusColor> = {
      'not started': 'slate',
      'in progress': 'blue',
      'done': 'emerald',
      'review': 'purple',
      'blocked': 'rose',
    };
    const c = legacyMap[val.toLowerCase()] || 'slate';
    return STATUS_COLORS[c];
  };

  const renderCellContent = (row: any, col: any) => {
    const val = getCellValue(row, col.id);
    const colType: ColumnType = (col.type as ColumnType) || 'TEXT';
    const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;

    if (colType === 'STATUS') {
      const color = getStatusColor(val, col);

      return (
        <div
          className="px-3 py-2 cursor-pointer min-h-[38px] flex items-center"
          onClick={(e) => {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUpwards = spaceBelow < 290;
            const pickerWidth = 260;
            let left = rect.left;
            if (left + pickerWidth > window.innerWidth - 16) {
              left = Math.max(16, window.innerWidth - pickerWidth - 16);
            }
            const top = openUpwards ? Math.max(10, rect.top - 285) : rect.bottom + 4;

            setStatusPicker({
              rowId: row.id,
              colId: col.id,
              position: { top, left, openUpwards },
            });
            setEditingStatus(null);
            setIsAddingStatus(false);
          }}
        >
          {val ? (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border truncate ${color.bg} ${color.text} ${color.border}`}>
              {val}
            </span>
          ) : (
            <span className="text-xs text-slate-400 italic hover:text-slate-600">+ Select status</span>
          )}
        </div>
      );
    }

    if (colType === 'DATE') {
      return (
        <div className="px-3 py-2">
          <input
            type="date"
            defaultValue={val}
            onChange={(e) => updateCell(row.id, col.id, e.target.value)}
            className="text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-400 rounded px-1.5 py-0.5 outline-none cursor-pointer"
          />
        </div>
      );
    }

    if (colType === 'NUMBER') {
      const opts = parseColOptions(col);
      const fmt = opts.numberFormat || 'number';
      const formatted = formatNumberValue(val, fmt);

      return isEditing ? (
        <input
          autoFocus
          type="number"
          step="any"
          defaultValue={val}
          className="w-full px-3 py-2 outline-none bg-blue-50/60 font-mono text-xs focus:ring-1 focus:ring-blue-400"
          onBlur={e => { updateCell(row.id, col.id, e.target.value); setEditingCell(null); }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
        />
      ) : (
        <div
          className="px-3 py-2 min-h-[38px] cursor-pointer font-mono text-xs text-slate-800 flex items-center"
          onClick={() => setEditingCell({ rowId: row.id, colId: col.id })}
        >
          {val !== '' && val !== null && val !== undefined ? (
            <span>{formatted}</span>
          ) : (
            <span className="text-slate-300 font-normal">0</span>
          )}
        </div>
      );
    }

    // Default: TEXT
    return isEditing ? (
      <input
        autoFocus
        defaultValue={val}
        className="w-full px-3 py-2 outline-none bg-blue-50/60 text-xs focus:ring-1 focus:ring-blue-400"
        onBlur={e => { updateCell(row.id, col.id, e.target.value); setEditingCell(null); }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
      />
    ) : (
      <div
        className="px-3 py-2 min-h-[38px] cursor-pointer text-xs text-slate-800"
        onClick={() => setEditingCell({ rowId: row.id, colId: col.id })}
      >
        {val || <span className="text-slate-300 italic">Empty</span>}
      </div>
    );
  };

  return (
    <div
      className={isEmbedded ? "my-6 border border-slate-200 rounded-2xl bg-white shadow-sm p-4" : ""}
      onClick={() => {
        setActiveColMenu(null);
        setStatusPicker(null);
      }}
    >
      {/* Title */}
      <div className="flex items-center justify-between mb-4">
        {isEmbedded ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="text-lg">🗄️</span>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={() => {
                  fetch(`/api/pages/${page.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title }),
                  });
                  socketRef.current?.emit('page:title', { pageId: page.id, title });
                  socketRef.current?.emit('page:sidebar-refresh');
                }}
                placeholder="Untitled Database"
                className="text-lg font-bold text-slate-800 border-none outline-none bg-transparent hover:bg-slate-100 rounded px-1.5 py-0.5 transition-colors"
              />
            </div>
            <button
              type="button"
              onClick={() => router.push(`/page/${page.id}`)}
              className="text-xs text-slate-400 hover:text-blue-600 px-2.5 py-1 rounded-lg hover:bg-slate-100 font-medium flex items-center gap-1 transition-colors"
            >
              Open as page ↗
            </button>
          </div>
        ) : (
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={() => {
              fetch(`/api/pages/${page.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title }),
              });
              socketRef.current?.emit('page:title', { pageId: page.id, title });
              socketRef.current?.emit('page:sidebar-refresh');
            }}
            placeholder="Untitled Database"
            className="w-full text-4xl font-bold text-slate-900 border-none outline-none bg-transparent mb-4 placeholder:text-slate-300"
          />
        )}
      </div>

      {/* Database Table with Horizontal Scroll Support */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
        <table
          className="w-full text-sm border-collapse"
          style={{ minWidth: `${Math.max(680, columns.length * 180 + 60)}px` }}
        >
          <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
            <tr>
              {columns.map((col, colIndex) => {
                const meta = COLUMN_TYPE_META[(col.type as ColumnType)] || COLUMN_TYPE_META.TEXT;
                const isMenuOpen = activeColMenu === col.id;
                const isRenaming = editingColName?.id === col.id;

                return (
                  <th
                    key={col.id}
                    style={{ minWidth: '170px' }}
                    className="relative text-left px-3 py-2.5 font-semibold text-slate-600 border-r border-slate-200 last:border-r-0 whitespace-nowrap group select-none"
                  >
                    <div className="flex items-center justify-between gap-2">
                      {isRenaming ? (
                        <input
                          autoFocus
                          defaultValue={col.name}
                          onBlur={e => updateColumnName(col.id, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') updateColumnName(col.id, (e.target as HTMLInputElement).value);
                            if (e.key === 'Escape') setEditingColName(null);
                          }}
                          className="px-1.5 py-0.5 text-xs font-semibold rounded border border-blue-400 outline-none bg-white text-slate-800"
                        />
                      ) : (
                        <div
                          className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveColMenu(isMenuOpen ? null : col.id);
                          }}
                        >
                          <span className="text-xs">
                            {col.type === 'NUMBER' && parseColOptions(col).numberFormat && NUMBER_FORMAT_META[parseColOptions(col).numberFormat as NumberFormat]
                              ? NUMBER_FORMAT_META[parseColOptions(col).numberFormat as NumberFormat].icon
                              : meta.icon}
                          </span>
                          <span className="text-xs font-medium text-slate-700">{col.name}</span>
                          <span className="text-[10px] text-slate-400 group-hover:text-slate-600">▾</span>
                        </div>
                      )}
                    </div>

                    {/* Column Header Dropdown Menu */}
                    {isMenuOpen && (
                      <div
                        className={`absolute ${colIndex >= columns.length - 2 ? 'right-0' : 'left-0'} top-full mt-1 z-40 bg-white border border-slate-200 rounded-xl shadow-xl p-2 w-60 font-normal text-xs text-slate-700`}
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveColMenu(null);
                            setEditingColName({ id: col.id, name: col.name });
                          }}
                          className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-left transition-colors font-medium text-slate-700 mb-1"
                        >
                          ✏️ Rename Column
                        </button>

                        <div className="h-px bg-slate-100 my-1" />

                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold px-2.5 py-1">
                          Column Type
                        </div>

                        {(['TEXT', 'STATUS', 'DATE', 'NUMBER'] as ColumnType[]).map(t => {
                          const m = COLUMN_TYPE_META[t];
                          const isActive = (col.type || 'TEXT') === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => updateColumnType(col.id, t)}
                              className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                                isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-100 text-slate-700'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span>{m.icon}</span>
                                <span>{m.label}</span>
                              </span>
                              {isActive && <span>✓</span>}
                            </button>
                          );
                        })}

                        {/* Number Format Options if column is NUMBER */}
                        {col.type === 'NUMBER' && (
                          <>
                            <div className="h-px bg-slate-100 my-1.5" />
                            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold px-2.5 py-1">
                              Number Format Options
                            </div>
                            {(['number', 'dollar', 'euro', 'pound', 'rupee', 'percent'] as NumberFormat[]).map(fmt => {
                              const fm = NUMBER_FORMAT_META[fmt];
                              const currentFmt = parseColOptions(col).numberFormat || 'number';
                              const isFmtActive = currentFmt === fmt;

                              return (
                                <button
                                  key={fmt}
                                  type="button"
                                  onClick={() => {
                                    const opts = parseColOptions(col);
                                    updateColumnOptions(col.id, { ...opts, numberFormat: fmt });
                                    setActiveColMenu(null);
                                  }}
                                  className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                                    isFmtActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <span>{fm.icon}</span>
                                    <span>{fm.label}</span>
                                  </span>
                                  {isFmtActive && <span>✓</span>}
                                </button>
                              );
                            })}
                          </>
                        )}

                        <div className="h-px bg-slate-100 my-1" />

                        <button
                          type="button"
                          onClick={() => deleteColumn(col.id)}
                          className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg hover:bg-red-50 text-red-600 text-left transition-colors font-medium"
                        >
                          🗑️ Delete Column
                        </button>
                      </div>
                    )}
                  </th>
                );
              })}

              {/* Add Column Button */}
              <th className="px-2 py-2 w-10 border-r border-slate-200">
                {addingCol ? (
                  <div className="flex items-center gap-1.5 p-1.5 bg-white border border-blue-400 rounded-xl shadow-lg z-30" onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={newColName}
                      onChange={e => setNewColName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') addColumn();
                        if (e.key === 'Escape') { setAddingCol(false); setNewColName(''); }
                      }}
                      placeholder="Column name"
                      className="w-28 text-xs px-2 py-1 outline-none font-normal border border-slate-200 rounded"
                    />
                    <select
                      value={newColType}
                      onChange={e => setNewColType(e.target.value as ColumnType)}
                      className="text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-1 outline-none font-normal"
                    >
                      <option value="TEXT">📝 Text</option>
                      <option value="STATUS">🏷️ Status</option>
                      <option value="DATE">📅 Date</option>
                      <option value="NUMBER">🔢 Number</option>
                    </select>

                    {newColType === 'NUMBER' && (
                      <select
                        value={newColNumberFormat}
                        onChange={e => setNewColNumberFormat(e.target.value as NumberFormat)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-1 outline-none font-normal"
                      >
                        <option value="number">🔢 Number</option>
                        <option value="dollar">💲 US Dollar ($)</option>
                        <option value="euro">💶 Euro (€)</option>
                        <option value="pound">💷 Pound (£)</option>
                        <option value="rupee">₹ Rupee (₹)</option>
                        <option value="percent">٪ Percent (%)</option>
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={addColumn}
                      disabled={!newColName.trim()}
                      className="text-xs bg-blue-600 text-white rounded px-2.5 py-1 font-medium hover:bg-blue-700 disabled:opacity-40"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAddingCol(false); setNewColName(''); }}
                      className="text-xs text-slate-400 hover:text-slate-600 px-1"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setAddingCol(true); }}
                    title="Add Column"
                    className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-200 text-slate-400 hover:text-slate-700 text-base font-bold mx-auto transition-colors"
                  >
                    +
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="text-center py-10 text-slate-400 text-xs">
                  No rows yet — click &quot;+ New Row&quot; below to add one.
                </td>
              </tr>
            ) : rows.map((row, ri) => (
              <tr
                key={row.id}
                className={`border-b border-slate-100 last:border-b-0 ${ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-blue-50/20 transition-colors group`}
              >
                {columns.map(col => (
                  <td key={col.id} style={{ minWidth: '170px' }} className="border-r border-slate-100 last:border-r-0 p-0">
                    {renderCellContent(row, col)}
                  </td>
                ))}
                <td className="w-10 min-w-[40px] text-center p-0">
                  <button
                    type="button"
                    title="Delete row"
                    onClick={() => deleteRow(row.id)}
                    className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-red-600 hover:bg-red-50 mx-auto opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between bg-slate-50/40">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors py-0.5 px-2 rounded hover:bg-slate-200/60"
          >
            <span className="text-sm font-bold leading-none">+</span> New Row
          </button>
          <span className="text-[11px] text-slate-400">
            {rows.length} {rows.length === 1 ? 'row' : 'rows'}
          </span>
        </div>
      </div>

      {/* Floating Status Picker (Fixed/Portal — Immune to table clipping) */}
      {statusPicker && (() => {
        const activeCol = columns.find(c => c.id === statusPicker.colId);
        const activeRow = rows.find(r => r.id === statusPicker.rowId);
        if (!activeCol || !activeRow) return null;
        const colStatuses = getColStatuses(activeCol);
        const currentVal = getCellValue(activeRow, activeCol.id);

        return (
          <>
            <div
              className="fixed inset-0 z-40 bg-transparent"
              onClick={() => setStatusPicker(null)}
            />
            <div
              className="fixed z-50 bg-white border border-slate-200 rounded-xl shadow-2xl p-2.5 w-[260px] animate-in fade-in zoom-in-95 duration-100 flex flex-col"
              style={{
                top: `${statusPicker.position?.top || 100}px`,
                left: `${statusPicker.position?.left || 100}px`,
                maxHeight: '320px',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  Status Options
                </span>
                <span className="text-[10px] text-slate-400">
                  {colStatuses.length} {colStatuses.length === 1 ? 'option' : 'options'}
                </span>
              </div>

              {/* Status List */}
              <div className="overflow-y-auto flex-1 space-y-1 py-0.5 pr-0.5">
                {colStatuses.map(st => {
                  const c = STATUS_COLORS[st.color] || STATUS_COLORS.slate;
                  const isBeingEdited = editingStatus?.id === st.id;

                  if (isBeingEdited) {
                    return (
                      <div key={st.id} className="p-2 bg-slate-50 border border-blue-200 rounded-lg space-y-2">
                        <input
                          autoFocus
                          value={editingStatus.name}
                          onChange={e => setEditingStatus({ ...editingStatus, name: e.target.value })}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveStatusEdit(activeCol);
                            if (e.key === 'Escape') setEditingStatus(null);
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                          placeholder="Status name"
                        />
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(['slate', 'blue', 'emerald', 'amber', 'purple', 'rose', 'cyan'] as StatusColor[]).map(clr => (
                            <button
                              key={clr}
                              type="button"
                              onClick={() => setEditingStatus({ ...editingStatus, color: clr })}
                              className={`w-4 h-4 rounded-full ${STATUS_COLORS[clr].dot} transition-transform ${
                                editingStatus.color === clr ? 'scale-125 ring-2 ring-offset-1 ring-blue-500' : 'hover:scale-110'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingStatus(null)}
                            className="px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-200 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveStatusEdit(activeCol)}
                            className="px-2.5 py-0.5 text-[11px] bg-blue-600 text-white font-medium rounded hover:bg-blue-700"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={st.id}
                      className="flex items-center justify-between group/st px-2 py-1.5 rounded-lg hover:bg-slate-100/80 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          updateCell(activeRow.id, activeCol.id, st.name);
                          setStatusPicker(null);
                        }}
                        className="flex items-center gap-2 flex-1 text-left min-w-0"
                      >
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border truncate ${c.bg} ${c.text} ${c.border}`}>
                          {st.name}
                        </span>
                        {currentVal === st.name && <span className="text-blue-600 text-xs ml-auto pr-1">✓</span>}
                      </button>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/st:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          title="Edit status"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingStatus({ id: st.id, name: st.name, color: st.color });
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-200 rounded text-[11px]"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          title="Delete status"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStatusOption(activeCol, st.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded text-[11px]"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add New Status Section */}
              <div className="pt-2 mt-1.5 border-t border-slate-100 shrink-0">
                {isAddingStatus ? (
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <input
                      autoFocus
                      value={newStatusName}
                      onChange={e => setNewStatusName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddStatusOption(activeCol);
                        if (e.key === 'Escape') setIsAddingStatus(false);
                      }}
                      placeholder="New status name..."
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                    />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(['slate', 'blue', 'emerald', 'amber', 'purple', 'rose', 'cyan'] as StatusColor[]).map(clr => (
                        <button
                          key={clr}
                          type="button"
                          onClick={() => setNewStatusColor(clr)}
                          className={`w-4 h-4 rounded-full ${STATUS_COLORS[clr].dot} transition-transform ${
                            newStatusColor === clr ? 'scale-125 ring-2 ring-offset-1 ring-blue-500' : 'hover:scale-110'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => { setIsAddingStatus(false); setNewStatusName(''); }}
                        className="px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-200 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddStatusOption(activeCol)}
                        disabled={!newStatusName.trim()}
                        className="px-2.5 py-0.5 text-[11px] bg-blue-600 text-white font-medium rounded hover:bg-blue-700 disabled:opacity-40"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingStatus(true)}
                    className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-xs text-blue-600 hover:bg-blue-50 font-medium transition-colors"
                  >
                    <span className="text-sm font-bold">+</span>
                    Add status option
                  </button>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
