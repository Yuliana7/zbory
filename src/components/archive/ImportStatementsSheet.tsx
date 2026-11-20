import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listCampaigns } from '../../utils/campaignStore';
import { listOwnJars } from '../../utils/ownJars';
import { parseCSV } from '../../utils/csvParser';
import { formatDateRange } from '../../utils/dateRange';
import { fmtUah } from '../../utils/friendJars';
import { draftFromStatement, importToArchive, knownSignatures, statementSignature, type ImportDraft, type ImportKind } from '../../utils/archiveImport';
import { SpinnerIcon } from '../../icons';
import { GoalReachedQuestion } from './GoalReachedQuestion';

/** «Додати з виписок»: closed jars straight into the archive, one per statement — for jars the app never
 * tracked (old friendly jars whose links are gone, past fundraisers). Each can be named, dated (the year
 * it's filed under) and given its goal; a statement the app already holds is left out unless taken. */
export function ImportStatementsSheet({ onClose, onImported }: { onClose: () => void; onImported: (years: number[]) => void }) {
  const { t } = useTranslation('archive');
  const [kind, setKind] = useState<ImportKind>('ownJar');
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [empty, setEmpty] = useState<string[]>([]);
  const [busy, setBusy] = useState<'reading' | 'saving' | null>(null);
  const [saveError, setSaveError] = useState(false);
  const known = useRef<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([listCampaigns(), listOwnJars()])
      .then(([cs, js]) => (known.current = knownSignatures(cs, js)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const read = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy('reading');
    const next: ImportDraft[] = [];
    const bad: string[] = [];
    const none: string[] = [];
    // the same file picked twice, or a statement already read in this sheet, counts as known too
    const seen = new Set([...known.current, ...drafts.map((d) => statementSignature(d.summary))]);
    for (const file of Array.from(files)) {
      try {
        const draft = draftFromStatement(file.name, await parseCSV(file), seen);
        if (!draft) none.push(file.name);
        else {
          next.push(draft);
          seen.add(statementSignature(draft.summary));
        }
      } catch {
        bad.push(file.name);
      }
    }
    setDrafts((ds) => [...ds, ...next]);
    setFailed(bad);
    setEmpty(none);
    setBusy(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const change = (key: string, patch: Partial<ImportDraft>) => setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const chosen = drafts.filter((d) => !d.skip).length;

  const save = async () => {
    setBusy('saving');
    setSaveError(false);
    try {
      onImported(await importToArchive(drafts, kind));
    } catch {
      setBusy(null);
      setSaveError(true);
    }
  };

  const field = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-base sm:text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100';
  const pill = (on: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${on ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-600 hover:text-gray-900'}`;

  return (
    <div
      className="screen-overlay z-[300] bg-black/40 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in text-left"
      style={{ paddingTop: 'var(--safe-top)' }}
      onClick={busy ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-statements-title"
        className="sheet-panel w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + var(--toolbar-gap) + 1.25rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 id="import-statements-title" className="text-lg font-bold text-gray-900">
            {t('import.title')}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{t('import.text')}</p>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-600">{t('import.kindLabel')}</p>
          <div role="radiogroup" aria-label={t('import.kindLabel')} className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
            {(['ownJar', 'project'] as const).map((k) => (
              <button key={k} role="radio" aria-checked={kind === k} disabled={!!busy} onClick={() => setKind(k)} className={pill(kind === k)}>
                {t(`import.kind.${k}`)}
              </button>
            ))}
          </div>
        </div>

        {drafts.length > 0 && (
          <ul className="space-y-3">
            {drafts.map((d) => (
              <li key={d.key} className={`rounded-xl border p-3 space-y-2.5 ${d.skip ? 'border-gray-200 bg-gray-50' : 'border-indigo-200 bg-white'}`}>
                <label className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={!d.skip}
                    disabled={!!busy}
                    onChange={(e) => change(d.key, { skip: !e.target.checked })}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-indigo-600"
                    aria-label={t('import.include', { name: d.name || d.fileName })}
                  />
                  <span className="min-w-0 text-sm">
                    <span className="block font-semibold text-gray-900">
                      {fmtUah(d.amount)} ₴ · {t('story.bandCount', { count: d.summary.donationCount })}
                    </span>
                    <span className="block text-xs text-gray-600">{formatDateRange(d.summary.firstDate, d.summary.lastDate)}</span>
                    <span className="block truncate text-xs text-gray-500">{d.fileName}</span>
                    {d.duplicate && <span className="mt-1 block text-xs font-medium text-amber-700">{t('import.duplicate')}</span>}
                  </span>
                </label>
                {!d.skip && (
                  <div className="space-y-2">
                    <label className="block">
                      <span className="mb-1 block text-xs text-gray-600">{t('import.name')}</span>
                      <input value={d.name} disabled={!!busy} onChange={(e) => change(d.key, { name: e.target.value })} className={field} />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-xs text-gray-600">{t('import.closedOn')}</span>
                        <input type="date" value={d.closedOn} disabled={!!busy} onChange={(e) => change(d.key, { closedOn: e.target.value })} className={field} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs text-gray-600">{t('import.goal')}</span>
                        <input
                          inputMode="decimal"
                          value={d.goal}
                          placeholder={t('import.goalNone')}
                          disabled={!!busy}
                          onChange={(e) => change(d.key, { goal: e.target.value })}
                          className={field}
                        />
                      </label>
                    </div>
                    {!d.goal.trim() && <GoalReachedQuestion value={d.goalReached} onChange={(v) => change(d.key, { goalReached: v })} disabled={!!busy} />}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {saveError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {t('import.saveError')}
          </p>
        )}
        {(failed.length > 0 || empty.length > 0) && (
          <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 space-y-1">
            {failed.length > 0 && <p>{t('import.readError', { files: failed.join(', ') })}</p>}
            {empty.length > 0 && <p>{t('import.noDonations', { files: empty.join(', ') })}</p>}
          </div>
        )}

        <input ref={fileRef} type="file" accept=".csv,text/csv" multiple className="hidden" onChange={(e) => void read(e.target.files)} />
        <button onClick={() => fileRef.current?.click()} disabled={!!busy} className="btn-secondary flex w-full items-center justify-center gap-2">
          {busy === 'reading' && <SpinnerIcon className="h-4 w-4 animate-spin" />}
          {busy === 'reading' ? t('statement.reading') : drafts.length ? t('import.pickMore') : t('import.pick')}
        </button>

        <div className="flex flex-col gap-2">
          {drafts.length > 0 && (
            <button onClick={() => void save()} disabled={!!busy || chosen === 0} className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
              {busy === 'saving' && <SpinnerIcon className="h-4 w-4 animate-spin" />}
              {busy === 'saving' ? t('import.saving') : t('import.confirm', { n: chosen })}
            </button>
          )}
          <button onClick={onClose} disabled={!!busy} className="btn-secondary disabled:opacity-50">
            {t('close.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
