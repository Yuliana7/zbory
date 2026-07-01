import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ManualRow } from '../../types';
import { manualRowsToCSVString, downloadCSV } from '../../utils/csvExporter';

interface ManualEntryEditorProps {
  onProceed: (rows: ManualRow[]) => void;
  onCancel?: () => void;
  initialRows?: ManualRow[];
  isLoading?: boolean;
  sourceFilename?: string;
}

interface RowErrors {
  date?: string;
  name?: string;
  amount?: string;
}

//const CATEGORIES = ['За посиланням', 'Разові поповнення'];

function createRow(): ManualRow {
  return {
    id: crypto.randomUUID(),
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

export function ManualEntryEditor({ onProceed, onCancel, initialRows, isLoading = false, sourceFilename }: ManualEntryEditorProps) {
  const { t } = useTranslation('manual');
  const [rows, setRows] = useState<ManualRow[]>(() => initialRows ?? [createRow()]);
  const [errors, setErrors] = useState<Record<string, RowErrors>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Running balance per row, recomputed whenever rows change
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
      return { ...prev, [id]: updated };
    });
    setGlobalError(null);
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, createRow()]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
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
      return false;
    }
    setGlobalError(null);
    return true;
  };

  const handleProceed = () => {
    if (validate()) onProceed(rows);
  };

  const handleSaveCSV = () => {
    if (!validate()) return;
    const csv = manualRowsToCSVString(rows);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const base = sourceFilename ? sourceFilename.replace(/\.csv$/i, '') : 'Jar_statement_manual';
    downloadCSV(csv, `${base}_${stamp}.csv`);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <p className="text-gray-500 text-sm mb-6 text-center">
        {onCancel ? t('editSubtitle') : t('subtitle')}
      </p>

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
            {rows.map((row) => {
              const rowErrors = errors[row.id] || {};
              return (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
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
                    {rowErrors.date && (
                      <p className="text-xs text-red-500 mt-0.5">{rowErrors.date}</p>
                    )}
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
                    {rowErrors.name && (
                      <p className="text-xs text-red-500 mt-0.5">{rowErrors.name}</p>
                    )}
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
                    {rowErrors.amount && (
                      <p className="text-xs text-red-500 mt-0.5">{rowErrors.amount}</p>
                    )}
                  </td>
                  {/* Category
                  <td className="px-3 py-2 align-top">
                    <select
                      value={row.category}
                      onChange={(e) => updateRow(row.id, 'category', e.target.value)}
                      className="w-44 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-colors"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </td> */}
                  {/* Balance — auto-computed, user may override */}
                  <td className="px-3 py-2 align-top">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        row.balance !== ''
                          ? row.balance
                          : (computedBalances.get(row.id)?.toFixed(2) ?? '')
                      }
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
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add row */}
      <button
        onClick={addRow}
        className="mt-4 flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {t('addRow')}
      </button>

      {/* Global validation error */}
      {globalError && (
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
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
