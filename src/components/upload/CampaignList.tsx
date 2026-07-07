import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import { listCampaigns, deleteCampaign, type CampaignMeta } from '../../utils/campaignStore';
import { formatCurrency } from '../../utils/dataAggregator';

const formatIsoDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
};

/** Saved campaigns on this device; hidden while the library is empty. */
export function CampaignList() {
  const { t } = useTranslation('campaigns');
  const { handleLoadCampaign, handleLoadCampaigns } = useAppContext();
  const [campaigns, setCampaigns] = useState<CampaignMeta[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    listCampaigns().then(setCampaigns).catch(() => setCampaigns([]));
  }, []);

  if (campaigns.length === 0) return null;

  const handleDelete = async (campaign: CampaignMeta) => {
    if (!window.confirm(t('deleteConfirm', { name: campaign.name }))) return;
    await deleteCampaign(campaign.id);
    setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
  };

  return (
    <div className="max-w-3xl mx-auto mb-10 animate-fade-in">
      <div className="flex items-baseline justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">📁 {t('listTitle')}</h3>
        <p className="text-xs text-gray-400">{t('listHint')}</p>
      </div>
      <ul className="space-y-2">
        {campaigns.map((campaign) => (
          <li
            key={campaign.id}
            className={`flex items-center gap-3 px-4 py-3 bg-white border rounded-xl shadow-sm transition-colors ${
              selected.has(campaign.id) ? 'border-indigo-400 bg-indigo-50/40' : 'border-gray-200 hover:border-indigo-300'
            }`}
          >
            {campaigns.length >= 2 && (
              <button
                onClick={() => toggleSelect(campaign.id)}
                title={t('select')}
                className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-colors ${
                  selected.has(campaign.id)
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-gray-300 text-transparent hover:border-indigo-400'
                }`}
              >
                ✓
              </button>
            )}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-gray-900 truncate">{campaign.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatIsoDate(campaign.summary.firstDate)} — {formatIsoDate(campaign.summary.lastDate)}
                {' · '}
                {t('donations', { count: campaign.summary.donationCount })}
                {' · '}
                {formatCurrency(campaign.summary.totalAmount)}
              </p>
            </div>
            <button
              onClick={() => handleLoadCampaign(campaign.id)}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              {t('open')}
            </button>
            <button
              onClick={() => handleDelete(campaign)}
              title={t('delete')}
              className="shrink-0 p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      {selected.size >= 2 && (
        <button
          onClick={() => handleLoadCampaigns([...selected])}
          className="mt-3 w-full px-4 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors animate-fade-in"
        >
          {t('analyzeTogether', { count: selected.size })}
        </button>
      )}
    </div>
  );
}
