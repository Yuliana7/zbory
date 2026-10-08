import { useTranslation } from 'react-i18next';
import { FriendsEditor } from '../../../components/FriendsEditor';
import { useAppContext } from '../../../context/AppContext';
import { computeFriendStats, friendProgress } from '../../../utils/friendJars';
import { Collapsible } from '../shared';

interface FriendsPanelProps {
  open: boolean;
  onToggle: () => void;
  count: number;
  /** the leaderboard card lets you pick which helpers it lists */
  pickable: boolean;
  hiddenFriendIds: string[];
  onHiddenFriendIdsChange: (ids: string[]) => void;
}

const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

export function FriendsPanel({ open, onToggle, count, pickable, hiddenFriendIds, onHiddenFriendIdsChange }: FriendsPanelProps) {
  const { t } = useTranslation('export');
  const { state } = useAppContext();
  const { ranked } = computeFriendStats(state.app.friends, state.app.aggregates?.totalAmount ?? 0);
  const hidden = new Set(hiddenFriendIds);
  const toggle = (id: string) => onHiddenFriendIdsChange(hidden.has(id) ? hiddenFriendIds.filter((x) => x !== id) : [...hiddenFriendIds, id]);

  return (
    <Collapsible
      label={t('friends.label')}
      badge={count > 0 ? t('friends.badge', { count }) : undefined}
      badgeColor="indigo"
      open={open}
      onToggle={onToggle}
    >
      {pickable && ranked.length > 0 && (
        <div className="mb-5 pb-5 border-b border-gray-100">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <p className="text-xs font-semibold text-gray-700">{t('friends.display.title')}</p>
            <div className="flex gap-3 text-xs">
              <button onClick={() => onHiddenFriendIdsChange([])} className="font-medium text-indigo-600 hover:text-indigo-800">
                {t('friends.display.all')}
              </button>
              <button
                onClick={() => onHiddenFriendIdsChange(ranked.map((f) => f.id))}
                className="font-medium text-gray-500 hover:text-gray-700"
              >
                {t('friends.display.none')}
              </button>
            </div>
          </div>
          <ul className="space-y-1">
            {ranked.map((f) => {
              const { pct, reached } = friendProgress(f);
              return (
                <li key={f.id}>
                  <label className="flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!hidden.has(f.id)}
                      onChange={() => toggle(f.id)}
                      className="w-5 h-5 shrink-0 accent-indigo-600"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{f.name || '—'}</span>
                    <span className="shrink-0 text-xs text-gray-500 whitespace-nowrap">
                      {fmt(f.raised)} ₴{pct !== null && ` · ${reached ? '✓ ' : ''}${Math.round(pct)}%`}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-gray-400">{t('friends.display.hint')}</p>
        </div>
      )}
      <FriendsEditor />
    </Collapsible>
  );
}
