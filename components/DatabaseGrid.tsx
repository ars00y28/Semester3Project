import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export type ColumnType = 'TEXT' | 'STATUS' | 'DATE' | 'NUMBER';

export const COLUMN_TYPE_META: Record<ColumnType, { label: string; icon: string }> = {
  TEXT: { label: 'Text', icon: '📝' },
  STATUS: { label: 'Status', icon: '🏷️' },
  DATE: { label: 'Date', icon: '📅' },
  NUMBER: { label: 'Number', icon: '🔢' },
};

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Not Started': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  'In Progress': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  'Done': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Review': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  'Blocked': { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
};

const DEFAULT_STATUSES = ['Not Started', 'In Progress', 'Done', 'Review', 'Blocked'];

interface Props {
  page: any;
  isEmbedded?: boolean;
}

export default function DatabaseGrid({ page, isEmbedded = false }: Props) {
  const [columns, setColumns] = useState<any[]>(page.columns || []);
  const [rows, setRows] = useState<any[]>(page.rows || []);
  const [title, setTitle] = useState(page.title || '');
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [activeColMenu, setActiveColMenu] = useState<string | null>(null);
  const [editingColName, setEditingColName] = useState<{ id: string; name: string } | null>(null);
  const [statusPicker, setStatusPicker] = useState<{ rowId: string; colId: string } | null>(null);
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<ColumnType>('TEXT');
  const socketRef = useRef<Socket | null>(null);

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

  const addColumn = async () => {
    if (!newColName.trim()) return;
    const res = await fetch('/api/databases/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId: page.id, name: newColName.trim(), type: newColType }),
    });
    const col = await res.json();
    setColumns(prev => [...prev, col]);
    socketRef.current?.emit('db:column-add', { pageId: page.id, column: col });
    setAddingCol(false);
    setNewColName('');
    setNewColType('TEXT');
  };

  const updateColumnType = async (columnId: string, type: ColumnType) => {
    setActiveColMenu(null);
    const col = columns.find(c => c.id === columnId);
    if (!col) return;
    const updated = { ...col, type };
    setColumns(prev => prev.map(c => c.id === columnId ? updated : c));
    await fetch('/api/databases/columns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: columnId, type }),
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

  const getCellValue = (row: any, columnId: string) =>
    row.cells?.find((c: any) => c.columnId === columnId)?.value || '';

  const renderCellContent = (row: any, col: any) => {
    const val = getCellValue(row, col.id);
    const colType: ColumnType = (col.type as ColumnType) || 'TEXT';
    const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;

    if (colType === 'STATUS') {
      const color = STATUS_COLORS[val] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
      return (
        <div
          className="relative px-3 py-2 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setStatusPicker({ rowId: row.id, colId: col.id });
          }}
        >
          {val ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${color.bg} ${color.text} ${color.border}`}>
              {val}
            </span>
          ) : (
            <span className="text-xs text-slate-400 italic hover:text-slate-600">+ Select status</span>
          )}

          {/* Status Picker Dropdown */}
          {statusPicker?.rowId === row.id && statusPicker?.colId === col.id && (
            <div
              className="absolute left-2 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 min-w-[150px]"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold px-2 py-1">Select Status</div>
              {DEFAULT_STATUSES.map(st => {
                const c = STATUS_COLORS[st];
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      updateCell(row.id, col.id, st);
                      setStatusPicker(null);
                    }}
                    className="flex items-center w-full px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
                  >
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
                      {st}
                    </span>
                  </button>
                );
              })}
            </div>
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
      return isEditing ? (
        <input
          autoFocus
          type="number"
          defaultValue={val}
          className="w-full px-3 py-2 outline-none bg-blue-50/60 font-mono text-xs focus:ring-1 focus:ring-blue-400"
          onBlur={e => { updateCell(row.id, col.id, e.target.value); setEditingCell(null); }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
        />
      ) : (
        <div
          className="px-3 py-2 min-h-[38px] cursor-pointer font-mono text-xs text-slate-800"
          onClick={() => setEditingCell({ rowId: row.id, colId: col.id })}
        >
          {val || <span className="text-slate-300">0</span>}
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

      {/* Database Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              {columns.map(col => {
                const meta = COLUMN_TYPE_META[(col.type as ColumnType)] || COLUMN_TYPE_META.TEXT;
                const isMenuOpen = activeColMenu === col.id;
                const isRenaming = editingColName?.id === col.id;

                return (
                  <th
                    key={col.id}
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
                          <span className="text-xs">{meta.icon}</span>
                          <span className="text-xs font-medium text-slate-700">{col.name}</span>
                          <span className="text-[10px] text-slate-400 group-hover:text-slate-600">▾</span>
                        </div>
                      )}
                    </div>

                    {/* Column Header Dropdown Menu */}
                    {isMenuOpen && (
                      <div
                        className="absolute left-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-xl shadow-xl p-2 w-56 font-normal text-xs text-slate-700"
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
                  <div className="flex items-center gap-1.5 p-1 bg-white border border-blue-400 rounded-lg shadow-sm" onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={newColName}
                      onChange={e => setNewColName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') addColumn();
                        if (e.key === 'Escape') { setAddingCol(false); setNewColName(''); }
                      }}
                      placeholder="Column name"
                      className="w-24 text-xs px-1.5 py-0.5 outline-none font-normal"
                    />
                    <select
                      value={newColType}
                      onChange={e => setNewColType(e.target.value as ColumnType)}
                      className="text-[11px] bg-slate-50 border border-slate-200 rounded px-1 py-0.5 outline-none font-normal"
                    >
                      <option value="TEXT">Text</option>
                      <option value="STATUS">Status</option>
                      <option value="DATE">Date</option>
                      <option value="NUMBER">Number</option>
                    </select>
                    <button
                      type="button"
                      onClick={addColumn}
                      className="text-xs bg-blue-600 text-white rounded px-2 py-0.5 font-medium hover:bg-blue-700"
                    >
                      Add
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
                  <td key={col.id} className="border-r border-slate-100 last:border-r-0 p-0">
                    {renderCellContent(row, col)}
                  </td>
                ))}
                <td className="w-8 text-center p-0">
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
    </div>
  );
}
