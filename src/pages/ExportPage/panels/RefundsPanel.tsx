import { useTranslation } from 'react-i18next';
import { Collapsible } from '../shared';

interface RefundsPanelProps {
  open: boolean;
  onToggle: () => void;
  impliedRefunds: number;
  showRefunds: boolean;
  onShowRefundsChange: (v: boolean) => void;
}

export function RefundsPanel({ open, onToggle, impliedRefunds, showRefunds, onShowRefundsChange }: RefundsPanelProps) {
  const { t } = useTranslation('export');
  return (
    <Collapsible label={t('refundsPanel.title')} icon="↩️" open={open} onToggle={onToggle} purple>
      <p className="text-xs text-purple-700 leading-relaxed mb-3">
        {t('refundsPanel.description', { amount: new Intl.NumberFormat('uk-UA').format(Math.round(impliedRefunds)) })}
      </p>
      <label className="flex items-center gap-3 cursor-pointer group">
        <div onClick={() => onShowRefundsChange(!showRefunds)} className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${showRefunds ? 'bg-purple-600' : 'bg-gray-300'}`}>
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${showRefunds ? 'translate-x-5' : 'translate-x-1'}`} />
        </div>
        <span className="text-xs font-medium text-purple-800 group-hover:text-purple-900">{t('refundsPanel.toggle')}</span>
      </label>
      <p className="text-xs text-purple-500 italic mt-2">{t('refundsPanel.note')}</p>
    </Collapsible>
  );
}
