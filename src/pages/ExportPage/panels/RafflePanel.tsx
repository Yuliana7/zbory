import { useTranslation } from 'react-i18next';
import type { Raffle } from '../../../types';
import { Collapsible } from '../shared';

interface RafflePanelProps {
  open: boolean;
  onToggle: () => void;
  raffles: Raffle[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

/** Which raffle this card is about, when the project has several of its kind. */
export function RafflePanel({ open, onToggle, raffles, selectedId, onSelect }: RafflePanelProps) {
  const { t } = useTranslation('export');
  const current = raffles.find((r) => r.id === selectedId) ?? raffles[0];
  return (
    <Collapsible label={t('raffle.label')} badge={current?.prize} badgeColor="indigo" open={open} onToggle={onToggle}>
      <ul className="space-y-1">
        {raffles.map((r) => (
          <li key={r.id}>
            <label className="flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input type="radio" name="card-raffle" checked={r.id === current?.id} onChange={() => onSelect(r.id)} className="w-5 h-5 shrink-0 accent-indigo-600" />
              <span className="min-w-0 truncate text-sm text-gray-800">{r.prize}</span>
            </label>
          </li>
        ))}
      </ul>
    </Collapsible>
  );
}
