import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import type { RenewAll } from '../../hooks/useRenewAll';
import type { OwnJar } from '../../types';
import { archiveCampaign } from '../../utils/campaignStore';
import { listOwnJars, setOwnJarArchived } from '../../utils/ownJars';
import { ownJarsFeeding } from '../../utils/archive';
import { fmtUah } from '../../utils/friendJars';
import { CheckIcon, SpinnerIcon } from '../../icons';

type Phase = 'confirm' | 'renewing' | 'archiving' | 'failed';

/** «Закрити збір»: what moves to the archive, an optional last renew so the final numbers are exact,
 * and the user's own jars for this project, which can go along. Then the project's archive page opens. */
export function CloseProjectSheet({ renew, onCancel }: { renew: RenewAll; onCancel: () => void }) {
  const { t } = useTranslation('archive');
  const { state, dispatch } = useAppContext();
  const { app } = state;
  const [refresh, setRefresh] = useState(renew.available);
  const [withOwn, setWithOwn] = useState(true);
  const [own, setOwn] = useState<OwnJar[]>([]);
  const [phase, setPhase] = useState<Phase>('confirm');

  useEffect(() => {
    listOwnJars()
      .then((jars) => setOwn(ownJarsFeeding(jars, app.monobankJar?.shortId)))
      .catch(() => setOwn([]));
  }, [app.monobankJar?.shortId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && phase === 'confirm' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, phase]);

  const id = app.activeCampaignId;
  if (!id || !app.aggregates) return null;

  const archive = async () => {
    setPhase('archiving');
    const done = await archiveCampaign(id).catch(() => null);
    if (!done) {
      setPhase('failed');
      return;
    }
    if (withOwn) await Promise.all(own.map((j) => setOwnJarArchived(j, done.archivedAt!).catch(() => null)));
    dispatch({ type: 'SECTION_CHANGED', payload: 'archive' });
    dispatch({ type: 'ARCHIVE_VIEW', payload: { kind: 'project', id } });
  };

  const confirm = async () => {
    if (refresh && renew.available) {
      setPhase('renewing');
      const outcome = await renew.renewAndWait();
      if (outcome === 'cancelled') return setPhase('confirm');
      if (outcome === 'failed') return setPhase('failed');
    }
    await archive();
  };

  // the token sheet takes the screen while a renew asks for it
  if (renew.askToken) return null;

  const total = app.aggregates.totalAmount;
  const friends = app.friends?.length ?? 0;
  const raffles = app.raffles?.length ?? 0;
  const kept = [
    { what: t('close.keptTotal'), note: app.goal ? t('close.keptTotalOf', { total: fmtUah(total), goal: fmtUah(app.goal) }) : `${fmtUah(total)} ₴` },
    { what: t('close.keptStatement'), note: t('close.keptStatementNote', { count: app.aggregates.donationCount }) },
    ...(friends > 0 ? [{ what: t('close.keptFriends', { count: friends }), note: t('close.keptFriendsNote') }] : []),
    { what: raffles > 0 ? t('close.keptStatsRaffles') : t('close.keptStats'), note: t('close.keptStatsNote') },
    { what: t('close.keptStyle'), note: t('close.keptStyleNote') },
  ];
  const busy = phase === 'renewing' || phase === 'archiving';

  return (
    <div
      className="screen-overlay z-[300] bg-black/40 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in text-left"
      style={{ paddingTop: 'var(--safe-top)' }}
      onClick={busy ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-project-title"
        className="sheet-panel w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + var(--toolbar-gap) + 1.25rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 id="close-project-title" className="text-lg font-bold text-gray-900">
            {t('close.title', { name: app.activeCampaignName ?? '' })}
          </h3>
          <p className="mt-1 text-sm text-gray-600">{t('close.text', { year: new Date().getFullYear() })}</p>
        </div>

        <ul className="space-y-2.5">
          {kept.map((k) => (
            <li key={k.what} className="flex gap-2.5 text-sm leading-snug">
              <CheckIcon className="mt-0.5 w-4 h-4 shrink-0 text-green-600" />
              <span>
                <span className="font-semibold text-gray-900">{k.what}</span> <span className="text-gray-600">{k.note}</span>
              </span>
            </li>
          ))}
        </ul>

        {renew.available && (
          <label className="flex items-center gap-3 rounded-xl bg-indigo-50 px-3.5 py-3 text-sm text-indigo-900">
            <input type="checkbox" checked={refresh} disabled={busy} onChange={(e) => setRefresh(e.target.checked)} className="w-5 h-5 shrink-0 accent-indigo-600" />
            {t('close.refreshFirst')}
          </label>
        )}
        {own.length > 0 && (
          <label className="flex items-center gap-3 rounded-xl bg-gray-50 px-3.5 py-3 text-sm text-gray-800">
            <input type="checkbox" checked={withOwn} disabled={busy} onChange={(e) => setWithOwn(e.target.checked)} className="w-5 h-5 shrink-0 accent-indigo-600" />
            {t('close.withOwn', { count: own.length })}
          </label>
        )}

        {phase === 'failed' && (
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t('close.renewFailed')}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={phase === 'failed' ? () => void archive() : () => void confirm()}
            disabled={busy}
            className="btn-primary flex items-center justify-center gap-2"
          >
            {busy && <SpinnerIcon className="w-4 h-4 animate-spin" />}
            {phase === 'renewing' ? t('close.renewing') : phase === 'archiving' ? t('close.archiving') : phase === 'failed' ? t('close.closeAnyway') : t('close.confirm')}
          </button>
          {phase === 'renewing' ? (
            <button onClick={renew.stop} className="btn-secondary">{t('close.stop')}</button>
          ) : (
            <button onClick={onCancel} disabled={busy} className="btn-secondary disabled:opacity-50">{t('close.cancel')}</button>
          )}
        </div>
        <p className="text-center text-xs text-gray-500">{t('close.undoHint')}</p>
      </div>
    </div>
  );
}
