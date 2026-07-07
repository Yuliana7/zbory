import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import { getCampaignMeta } from '../../utils/campaignStore';

const pad2 = (n: number) => String(n).padStart(2, '0');
const shortDate = (d: Date) => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;

interface SaveCampaignControlProps {
  /** Matches the unified btn-secondary sizing of sibling action buttons (upload preview row) */
  fullWidth?: boolean;
}

/** "Зберегти збір": names the current dataset and puts it in the library. */
export function SaveCampaignControl({ fullWidth }: SaveCampaignControlProps) {
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
    let cancelled = false;
    const fallback = () => {
      if (app.originalFileName) return app.originalFileName.replace(/\.csv$/i, '');
      if (app.aggregates) {
        return t('defaultName', {
          from: shortDate(app.aggregates.firstDate),
          to: shortDate(app.aggregates.lastDate),
        });
      }
      return '';
    };
    if (app.activeCampaignId) {
      getCampaignMeta(app.activeCampaignId).then((meta) => {
        if (!cancelled) setName(meta?.name ?? fallback());
      });
    } else {
      setName(fallback());
    }
    return () => {
      cancelled = true;
    };
  }, [open, app.activeCampaignId, app.originalFileName, app.aggregates, t]);

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  const handleConfirm = async () => {
    if (!name.trim()) return;
    const meta = await handleSaveCampaign(name);
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
      {justSaved ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h9.172a2 2 0 011.414.586l1.828 1.828A2 2 0 0120 6.828V19a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4v4h8V4" />
        </svg>
      )}
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
