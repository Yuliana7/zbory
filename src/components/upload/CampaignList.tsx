import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import { deleteCampaign, type CampaignMeta } from '../../utils/campaignStore';
import { formatCurrency } from '../../utils/dataAggregator';
import { CheckIcon, FolderIcon, TrashIcon } from '../../icons';

const formatIsoDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
};

interface CampaignListProps {
  campaigns: CampaignMeta[];
  onCampaignsChange: (campaigns: CampaignMeta[]) => void;
}

/** Saved campaigns on this device — the list itself lives in UploadPage so it
 * can decide between this and the first-run empty state. */
export function CampaignList({ campaigns, onCampaignsChange }: CampaignListProps) {
  const { t } = useTranslation('campaigns');
  const { handleLoadCampaign, handleLoadCampaigns } = useAppContext();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleDelete = async (campaign: CampaignMeta) => {
    if (!window.confirm(t('deleteConfirm', { name: campaign.name }))) return;
    await deleteCampaign(campaign.id);
    onCampaignsChange(campaigns.filter((c) => c.id !== campaign.id));
  };

  return (
    <div className="max-w-3xl mx-auto mb-10 animate-fade-in">
      <div className="flex items-baseline justify-between mb-3 px-1">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 uppercase tracking-wider">
          <FolderIcon className="w-4 h-4" />
          {t('listTitle')}
        </h3>
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
                className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selected.has(campaign.id)
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-gray-300 text-transparent hover:border-indigo-400'
                }`}
              >
                <CheckIcon className="w-3 h-3" />
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
              <TrashIcon className="w-4 h-4" />
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
