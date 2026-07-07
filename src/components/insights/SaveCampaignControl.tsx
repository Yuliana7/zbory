import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import { getCampaignMeta } from '../../utils/campaignStore';

const pad2 = (n: number) => String(n).padStart(2, '0');
const shortDate = (d: Date) => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;

/** "Зберегти збір" in the insights header: names the current dataset and puts it in the library. */
export function SaveCampaignControl() {
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

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800
                   bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm
                   hover:border-gray-300 transition-all"
      >
        <span className="leading-none">💾</span>
        {justSaved ? t('saved') : app.activeCampaignId ? t('updateButton') : t('saveButton')}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-20 w-72 p-3 bg-white border border-gray-200 rounded-xl shadow-lg animate-fade-in">
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
      )}
    </div>
  );
}
