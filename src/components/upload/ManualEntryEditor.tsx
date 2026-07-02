import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ManualRow } from '../../types';
import { manualRowsToCSVString, downloadCSV } from '../../utils/csvExporter';
import { generateId } from '../../utils/id';

const ROWS_PER_PAGE = 10;

interface ManualEntryEditorProps {
  onProceed: (rows: ManualRow[]) => void;
  onCancel?: () => void;
  initialRows?: ManualRow[];
  isLoading?: boolean;
}

interface RowErrors {
  date?: string;
  name?: string;
  amount?: string;
}

function createRow(): ManualRow {
  return {
    id: generateId(),
    date: '',
    time: '',
    name: '',
    amount: '',
    comment: '',
    balance: '',
  };
}

function validateRow(row: ManualRow, t: (key: string) => string): RowErrors {
  const errors: RowErrors = {};
  if (!row.date) errors.date = t('validation.dateRequired');
  if (!row.name.trim()) errors.name = t('validation.nameRequired');
  const amount = parseFloat(row.amount);
  if (!row.amount || isNaN(amount) || amount <= 0) {
    errors.amount = t('validation.amountRequired');
  }
  return errors;
}

// Computes which page buttons to show: always first/last, ±1 around current, with '...' gaps.
function getPageWindow(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total));
  const sorted = Array.from(set).sort((a, b) => a - b);
  const result: (number | '...')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('...');
    result.push(sorted[i]);
  }
  return result;
}

export function ManualEntryEditor({ onProceed, onCancel, initialRows, isLoading = false }: ManualEntryEditorProps) {
  const { t } = useTranslation('manual');
  const [rows, setRows] = useState<ManualRow[]>(() => initialRows ?? [createRow()]);
  const [errors, setErrors] = useState<Record<string, RowErrors>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  // Tracks the global row index (position in `rows`) the user last navigated to
  const [anchorRowIdx, setAnchorRowIdx] = useState(-1);
  const [jumpInput, setJumpInput] = useState('');

  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  // Sorted global indices of rows that have validation errors
  const errorIndices = useMemo(() => {
    return rows
      .map((row, idx) => ({ idx, hasError: errors[row.id] && Object.keys(errors[row.id]).length > 0 }))
      .filter((r) => r.hasError)
      .map((r) => r.idx);
  }, [rows, errors]);

  // Position of anchor in errorIndices (-1 if that row was already fixed)
  const anchorPosInErrors = useMemo(
    () => errorIndices.indexOf(anchorRowIdx),
    [errorIndices, anchorRowIdx]
  );

  // First error strictly after the anchor row
  const nextErrorPos = useMemo(
    () => errorIndices.findIndex(idx => idx > anchorRowIdx),
    [errorIndices, anchorRowIdx]
  );

  // Last error strictly before the anchor row
  const prevErrorPos = useMemo(() => {
    for (let i = errorIndices.length - 1; i >= 0; i--) {
      if (errorIndices[i] < anchorRowIdx) return i;
    }
    return -1;
  }, [errorIndices, anchorRowIdx]);

  // Which pages have at least one error row
  const pagesWithErrors = useMemo(() => {
    const set = new Set<number>();
    errorIndices.forEach((idx) => set.add(Math.ceil((idx + 1) / ROWS_PER_PAGE)));
    return set;
  }, [errorIndices]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const jumpToError = useCallback((pos: number) => {
    const rowIdx = errorIndices[pos];
    if (rowIdx === undefined) return;
    setAnchorRowIdx(rowIdx);
    setCurrentPage(Math.ceil((rowIdx + 1) / ROWS_PER_PAGE));
  }, [errorIndices]);

  const computedBalances = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const da = `${a.date}T${a.time || '12:00'}`;
      const db = `${b.date}T${b.time || '12:00'}`;
      return da.localeCompare(db);
    });
    let running = 0;
    const map = new Map<string, number>();
    for (const row of sorted) {
      running += parseFloat(row.amount) || 0;
      map.set(row.id, running);
    }
    return map;
  }, [rows]);

  const updateRow = useCallback((id: string, field: keyof ManualRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const updated = { ...prev[id] };
      delete (updated as Record<string, string>)[field];
      if (Object.keys(updated).length === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: updated };
    });
    setGlobalError(null);
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => {
      const next = [...prev, createRow()];
      setCurrentPage(Math.ceil(next.length / ROWS_PER_PAGE));
      return next;
    });
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      const newTotal = Math.max(1, Math.ceil(next.length / ROWS_PER_PAGE));
      setCurrentPage((p) => Math.min(p, newTotal));
      return next;
    });
    setErrors((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const validate = (): boolean => {
    if (rows.length === 0) {
      setGlobalError(t('validation.noRows'));
      return false;
    }
    const newErrors: Record<string, RowErrors> = {};
    let hasErrors = false;
    for (const row of rows) {
      const rowErrors = validateRow(row, t);
      if (Object.keys(rowErrors).length > 0) {
        newErrors[row.id] = rowErrors;
        hasErrors = true;
      }
    }
    setErrors(newErrors);
    if (hasErrors) {
      setGlobalError(t('validation.hasErrors'));
      // Jump to first error and activate error navigation
      const firstErrIdx = rows.findIndex((r) => newErrors[r.id]);
      if (firstErrIdx >= 0) {
        setAnchorRowIdx(firstErrIdx);
        setCurrentPage(Math.ceil((firstErrIdx + 1) / ROWS_PER_PAGE));
      }
      return false;
    }
    setGlobalError(null);
    setAnchorRowIdx(-1);
    return true;
  };

  const handleProceed = () => { if (validate()) onProceed(rows); };

  const handleSaveCSV = () => {
    if (!validate()) return;
    const csv = manualRowsToCSVString(rows);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    downloadCSV(csv, `jar_statement_manual_${stamp}.csv`);
  };

  const handleJumpCommit = () => {
    const p = parseInt(jumpInput, 10);
    if (!isNaN(p)) goToPage(p);
    setJumpInput('');
  };

  const pageWindow = getPageWindow(safePage, totalPages);

  return (
    <div className="max-w-6xl mx-auto">
      <p className="text-gray-500 text-sm mb-6 text-center">
        {onCancel ? t('editSubtitle') : t('subtitle')}
      </p>

      {/* Error navigation bar */}
      {errorIndices.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
          <span className="text-sm font-medium text-red-700">
            ⚠ {t('pagination.rowsWithErrors', { count: errorIndices.length })}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => jumpToError(prevErrorPos)}
              disabled={prevErrorPos < 0}
              className="p-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={t('pagination.prevError')}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {anchorPosInErrors >= 0 ? (
              <button
                onClick={() => jumpToError(anchorPosInErrors)}
                className="text-xs text-red-600 tabular-nums whitespace-nowrap underline underline-offset-2 hover:text-red-800 transition-colors"
              >
                {t('pagination.row')} {errorIndices[anchorPosInErrors] + 1} · {anchorPosInErrors + 1} {t('pagination.errorOf')} {errorIndices.length}
              </button>
            ) : nextErrorPos >= 0 ? (
              <button
                onClick={() => jumpToError(nextErrorPos)}
                className="text-xs text-red-600 tabular-nums whitespace-nowrap underline underline-offset-2 hover:text-red-800 transition-colors"
              >
                → {t('pagination.row')} {errorIndices[nextErrorPos] + 1}
              </button>
            ) : (
              <button
                onClick={() => jumpToError(prevErrorPos)}
                className="text-xs text-red-600 tabular-nums whitespace-nowrap underline underline-offset-2 hover:text-red-800 transition-colors"
              >
                ← {t('pagination.row')} {errorIndices[prevErrorPos] + 1}
              </button>
            )}
            <button
              onClick={() => jumpToError(nextErrorPos)}
              disabled={nextErrorPos < 0}
              className="p-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={t('pagination.nextError')}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Scrollable table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {(['date', 'time', 'name', 'amount', 'balance', 'comment'] as const).map((col) => (
                <th
                  key={col}
                  className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {t(`columns.${col}`)}
                </th>
              ))}
              <th className="px-3 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center text-gray-400">
                  <p className="font-medium text-sm">{t('empty.title')}</p>
                  <p className="text-xs mt-1">{t('empty.description')}</p>
                </td>
              </tr>
            )}
            {rows.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE).map((row) => {
              const rowErrors = errors[row.id] || {};
              const hasRowError = Object.keys(rowErrors).length > 0;
              return (
                <tr key={row.id} className={`transition-colors ${hasRowError ? 'bg-red-50/40' : 'hover:bg-gray-50'}`}>
                  {/* Date */}
                  <td className="px-3 py-2 align-top">
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => updateRow(row.id, 'date', e.target.value)}
                      className={`w-36 px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                        rowErrors.date ? 'border-red-400 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    {rowErrors.date && <p className="text-xs text-red-500 mt-0.5">{rowErrors.date}</p>}
                  </td>
                  {/* Time */}
                  <td className="px-3 py-2 align-top">
                    <input
                      type="time"
                      value={row.time}
                      onChange={(e) => updateRow(row.id, 'time', e.target.value)}
                      className="w-28 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                    />
                  </td>
                  {/* Name */}
                  <td className="px-3 py-2 align-top">
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                      placeholder={t('placeholders.name')}
                      className={`w-44 px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                        rowErrors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    {rowErrors.name && <p className="text-xs text-red-500 mt-0.5">{rowErrors.name}</p>}
                  </td>
                  {/* Amount */}
                  <td className="px-3 py-2 align-top">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={row.amount}
                      onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                      placeholder={t('placeholders.amount')}
                      className={`w-28 px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                        rowErrors.amount ? 'border-red-400 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    {rowErrors.amount && <p className="text-xs text-red-500 mt-0.5">{rowErrors.amount}</p>}
                  </td>
                  {/* Balance — auto-computed, user may override */}
                  <td className="px-3 py-2 align-top">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.balance !== '' ? row.balance : (computedBalances.get(row.id)?.toFixed(2) ?? '')}
                      onChange={(e) => updateRow(row.id, 'balance', e.target.value)}
                      className={`w-28 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                        row.balance === '' ? 'text-gray-400' : 'text-gray-900'
                      }`}
                    />
                  </td>
                  {/* Comment */}
                  <td className="px-3 py-2 align-top">
                    <input
                      type="text"
                      value={row.comment}
                      onChange={(e) => updateRow(row.id, 'comment', e.target.value)}
                      placeholder={t('placeholders.comment')}
                      className="w-44 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                    />
                  </td>
                  {/* Delete */}
                  <td className="px-3 py-2 align-top">
                    <button
                      onClick={() => removeRow(row.id)}
                      title={t('removeRow')}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add row + Pagination */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={addRow}
          className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('addRow')}
        </button>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Prev */}
            <button
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage === 1}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Page window */}
            {pageWindow.map((item, i) =>
              item === '...' ? (
                <span key={`ellipsis-${i}`} className="px-1 text-gray-400 text-sm select-none">…</span>
              ) : (
                <button
                  key={item}
                  onClick={() => goToPage(item)}
                  className={`relative min-w-[2rem] h-8 px-2 rounded-lg text-sm font-medium transition-colors ${
                    item === safePage
                      ? 'bg-indigo-600 text-white'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {item}
                  {pagesWithErrors.has(item) && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-1 ring-white" />
                  )}
                </button>
              )
            )}

            {/* Next */}
            <button
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Go-to-page */}
            <div className="flex items-center gap-1.5 ml-1 border-l border-gray-200 pl-2.5">
              <span className="text-xs text-gray-400 whitespace-nowrap">{t('pagination.goto')}</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleJumpCommit(); }}
                className="w-24 px-1.5 py-1 text-sm text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                placeholder={String(safePage)}
              />
              <button
                onClick={handleJumpCommit}
                className="px-2 py-1 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Global validation error */}
      {globalError && errorIndices.length === 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{globalError}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-between">
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-6 py-3 border border-gray-300 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('backToPreview')}
          </button>
        )}
        <div className="flex flex-col sm:flex-row gap-3 sm:ml-auto">
          <button
            onClick={handleSaveCSV}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-6 py-3 border border-indigo-600 text-indigo-600 rounded-xl font-medium hover:bg-indigo-50 transition-colors text-sm disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {t('saveCSV')}
          </button>
          <button
            onClick={handleProceed}
            disabled={isLoading}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors text-sm disabled:opacity-50"
          >
            {t('proceed')}
          </button>
        </div>
      </div>
    </div>
  );
}
