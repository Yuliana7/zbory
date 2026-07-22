import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import { CheckIcon, SaveIcon } from '../../icons';

const pad2 = (n: number) => String(n).padStart(2, '0');
const shortDate = (d: Date) => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;

interface SaveCampaignControlProps {
  /** Matches the unified btn-secondary sizing of sibling action buttons (upload preview row) */
  fullWidth?: boolean;
  /** Goal value owned by the caller (e.g. the upload preview's not-yet-committed
   * goal input) — takes precedence over app.goal so saving here can't drop it. */
  goalOverride?: number;
}

/** "Зберегти збір": names the current dataset and puts it in the library. */
export function SaveCampaignControl({ fullWidth, goalOverride }: SaveCampaignControlProps) {
  const { t } = useTranslation('campaigns');
  const { state, handleSaveCampaign } = useAppContext();
  const { app } = state;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prefill: current campaign name → file name → date-range fallback
  useEffect(() => {
    if (!open) return;
    if (app.activeCampaignName) {
      setName(app.activeCampaignName);
      return;
    }
    if (app.originalFileName) {
      setName(app.originalFileName.replace(/\.csv$/i, ''));
      return;
    }
    if (app.aggregates) {
      setName(t('defaultName', {
        from: shortDate(app.aggregates.firstDate),
        to: shortDate(app.aggregates.lastDate),
      }));
      return;
    }
    setName('');
  }, [open, app.activeCampaignName, app.originalFileName, app.aggregates, t]);

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  const handleConfirm = async () => {
    if (!name.trim()) return;
    const meta = await handleSaveCampaign(name, goalOverride);
    if (meta) {
      setOpen(false);
      setJustSaved(true);
      savedTimer.current = setTimeout(() => setJustSaved(false), 2000);
    }
  };

  const trigger = (
    <button
      onClick={() => setOpen((v) => !v)}
      className={
        fullWidth
          ? 'btn-secondary flex-1 flex items-center justify-center gap-2'
          : 'flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm hover:border-gray-300 transition-all'
      }
    >
      {justSaved ? <CheckIcon className="w-4 h-4" /> : <SaveIcon className="w-4 h-4" />}
      {justSaved ? t('saved') : app.activeCampaignId ? t('updateButton') : t('saveButton')}
    </button>
  );

  const popover = open && (
    <div
      className={`absolute top-full z-20 w-72 max-w-[90vw] p-3 bg-white border border-gray-200 rounded-xl shadow-lg animate-fade-in ${
        // fullWidth: this trigger is one of several buttons in a row, so center
        // on the whole row (its nearest positioned ancestor) instead of on just
        // this narrow button — otherwise the 288px popup overhangs its siblings.
        fullWidth ? 'left-1/2 -translate-x-1/2 mt-3' : 'right-0 mt-2'
      }`}
    >
      <label className="block text-xs font-semibold text-gray-700 mb-1">{t('nameLabel')}</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
        placeholder={t('namePlaceholder')}
        autoFocus
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900
                   focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={!name.trim()}
          className="flex-1 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700
                     disabled:opacity-40 text-white rounded-lg transition-colors"
        >
          {t('confirmSave')}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );

  // fullWidth: no own positioning wrapper — the parent row supplies `relative`
  // so the popover centers on the whole row, not this one narrow button.
  if (fullWidth) {
    return (
      <>
        {trigger}
        {popover}
      </>
    );
  }

  return (
    <div className="relative">
      {trigger}
      {popover}
    </div>
  );
}
