import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon, LinkIcon, RefreshIcon, SpinnerIcon, TrashIcon } from '../../icons';
import { friendProgress, parseAmount, type FriendDraftRow } from '../../utils/friendJars';
import type { JarErrorKind } from '../../utils/monobankJar';

const INPUT =
  // text-base (16px) on a phone: anything smaller makes iOS zoom the page on focus
  'px-3 py-2 sm:py-1.5 rounded-lg border border-gray-200 bg-white text-base sm:text-sm text-gray-900 min-w-0 w-full ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-gray-400';

/** Column widths shared by the header and the rows (from the `sm` breakpoint up). */
export const FRIEND_COLUMNS = 'sm:grid-cols-[minmax(0,1.6fr)_6rem_6rem_4rem_6.5rem_6.5rem]';

/** Class names for the one-line layout. Written out in full (not built from strings) so Tailwind sees them;
 * `compact` — a narrow container such as the export sidebar, where the viewport width says nothing about
 * the room — gets none of them and keeps the stacked phone layout. */
const WIDE = {
  grid: `sm:items-center ${FRIEND_COLUMNS}`,
  contents: 'sm:contents',
  o1: 'sm:order-1',
  o2: 'sm:order-2',
  o3: 'sm:order-3',
  o4: 'sm:order-4 sm:text-center',
  o5: 'sm:order-5',
  o6: 'sm:order-6',
};
const STACKED = { grid: '', contents: '', o1: '', o2: '', o3: '', o4: '', o5: '', o6: '' };

const ICON_BUTTON = 'p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-transparent';

interface FriendRowProps {
  row: FriendDraftRow;
  duplicate: boolean;
  busy: boolean;
  /** what went wrong the last time this jar was read, if anything */
  error?: JarErrorKind;
  onChange: (change: Partial<FriendDraftRow>) => void;
  onRemove: () => void;
  onRefresh: () => void;
  onLink: (input: string) => Promise<JarErrorKind | 'invalid' | 'duplicate' | null>;
  onUnlink: () => void;
  /** keep the stacked layout at any width */
  compact?: boolean;
}

const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id);

/** One helper on one line: name, amount, target, progress %, status (a switch: open ⇄ closed) and the
 * actions — the jar link, a refresh when linked, delete. The link's details (id, when it was read,
 * unlink) or its id field open under the row only when asked for, so a list of rows stays calm.
 * A closed helper is skipped by refreshes but can be edited by hand like any other. Phone: three stacked
 * lines; from `sm` up: one line that lines up with the column header. */
export function FriendRow({ row, duplicate, busy, error, onChange, onRemove, onRefresh, onLink, onUnlink, compact = false }: FriendRowProps) {
  const L = compact ? STACKED : WIDE;
  const { t } = useTranslation('export');
  const [showLink, setShowLink] = useState(false);
  const [idInput, setIdInput] = useState('');
  const [linkError, setLinkError] = useState<JarErrorKind | 'invalid' | 'duplicate' | null>(null);
  const closed = !!row.closed;
  const linked = !!row.jarId;

  // Progress as typed so far, so the row answers "is that a hit?" at once
  const progress = friendProgress({
    id: row.id,
    name: row.name,
    raised: parseAmount(row.raised) ?? 0,
    target: parseAmount(row.target) ?? undefined,
  });

  const submitLink = async () => {
    const result = await onLink(idInput);
    setLinkError(result);
    if (!result) {
      setShowLink(false);
      setIdInput('');
    }
  };

  const shownError = error ?? linkError;
  // a read that failed is worth seeing without opening anything
  const detailsOpen = showLink || !!error;
  const linkLabel = linked ? t('friends.linkedTitle', { id: shortId(row.jarId!) }) : t('friends.link');

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${closed ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'}`}>
      <div className={`grid grid-cols-2 gap-2 ${L.grid}`}>
        {/* phone: name + actions share the first line; desktop: they are separate cells (see `order`) */}
        <div className={`col-span-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 ${L.contents}`}>
          <input
            type="text"
            value={row.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={t('friends.namePlaceholder')}
            aria-label={t('friends.namePlaceholder')}
            aria-invalid={duplicate}
            className={`${INPUT} ${L.o1} ${duplicate ? 'border-red-400 focus:ring-red-300' : ''}`}
          />
          <div className={`flex items-center justify-end gap-0.5 ${L.o6}`}>
            <button
              onClick={() => setShowLink((v) => !v)}
              aria-expanded={showLink}
              title={linkLabel}
              aria-label={linkLabel}
              className={`${ICON_BUTTON} ${linked ? 'text-indigo-500 hover:bg-indigo-50' : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'} ${showLink ? 'bg-gray-100' : ''}`}
            >
              <LinkIcon className="w-4 h-4" />
            </button>
            {linked && (
              <button
                onClick={onRefresh}
                disabled={busy || closed}
                title={closed ? t('friends.refreshClosed') : t('friends.refresh')}
                aria-label={t('friends.refresh')}
                className={`${ICON_BUTTON} text-gray-400 hover:text-indigo-600 hover:bg-indigo-50`}
              >
                {busy ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : <RefreshIcon className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={onRemove}
              title={t('friends.remove')}
              aria-label={t('friends.remove')}
              className={`${ICON_BUTTON} text-gray-300 hover:text-red-500 hover:bg-red-50`}
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className={`col-span-2 grid grid-cols-2 gap-2 ${L.contents}`}>
          <input
            type="text"
            inputMode="decimal"
            value={row.raised}
            onChange={(e) => onChange({ raised: e.target.value })}
            placeholder={t('friends.amountPlaceholder')}
            aria-label={t('friends.amountPlaceholder')}
            className={`${INPUT} ${L.o2}`}
          />
          <input
            type="text"
            inputMode="decimal"
            value={row.target}
            onChange={(e) => onChange({ target: e.target.value })}
            placeholder={t('friends.targetPlaceholder')}
            aria-label={t('friends.targetPlaceholder')}
            className={`${INPUT} ${L.o3}`}
          />
        </div>

        <div className={`col-span-2 flex items-center gap-3 ${L.contents}`}>
          <span
            className={`text-sm tabular-nums ${L.o4} ${
              progress.reached ? 'font-semibold text-green-600' : progress.pct === null ? 'text-gray-300' : 'text-gray-700'
            }`}
            title={progress.pct === null ? undefined : t('friends.progress', { pct: Math.round(progress.pct) })}
          >
            {progress.pct === null ? '—' : `${progress.reached ? '✓ ' : ''}${Math.round(progress.pct)}%`}
          </span>
          <button
            type="button"
            onClick={() => onChange({ closed: !closed })}
            aria-pressed={closed}
            title={closed ? t('friends.status.reopen') : t('friends.status.close')}
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors ${L.o5} ${
              closed ? 'bg-gray-200 text-gray-600 hover:bg-gray-300' : 'text-green-700 hover:bg-green-50'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${closed ? 'bg-gray-400' : 'bg-green-500'}`} />
            {closed ? t('friends.status.closed') : t('friends.status.open')}
          </button>
        </div>
      </div>

      {duplicate && <p className="mt-1.5 text-xs text-red-500">{t('friends.duplicate')}</p>}

      {detailsOpen && (
        <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
          {linked ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span title={row.jarId}>{t('friends.linkedId', { id: shortId(row.jarId!) })}</span>
              {row.syncedAt && (
                <span>
                  {t('friends.synced', {
                    when: new Date(row.syncedAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                  })}
                </span>
              )}
              <button onClick={onUnlink} className="text-gray-400 hover:text-gray-700 underline">
                {t('friends.unlink')}
              </button>
            </p>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={idInput}
                autoFocus
                onChange={(e) => {
                  setIdInput(e.target.value);
                  setLinkError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && submitLink()}
                placeholder={t('friends.idPlaceholder')}
                aria-label={t('friends.idPlaceholder')}
                className={`${INPUT} flex-1`}
              />
              <button
                onClick={submitLink}
                disabled={busy || idInput.trim() === ''}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
              >
                {busy ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                {t('friends.linkConfirm')}
              </button>
            </div>
          )}
          {shownError && <p className="mt-1 text-red-500">{t(`friends.jarErrors.${shownError}`)}</p>}
        </div>
      )}
    </div>
  );
}
