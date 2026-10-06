import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import { deleteCampaign, type CampaignMeta } from '../../utils/campaignStore';
import { formatCurrency } from '../../utils/dataAggregator';
import { ArrowRightIcon, CheckIcon, GlobeIcon } from '../../icons';
import { CampaignActionsSheet, type CampaignAction } from './CampaignActionsSheet';

const formatIsoDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
};

interface CampaignListProps {
  campaigns: CampaignMeta[];
  onCampaignsChange: (campaigns: CampaignMeta[]) => void;
  /** "Змінити" → one of the actions in the menu; the page opens the matching screen */
  onAction: (campaign: CampaignMeta, action: CampaignAction) => void;
}

/** Saved projects on this device. "Аналітика" goes straight to step 2 with
 * everything that was saved (rows, goal, helpers, style); "Змінити" opens a
 * small menu for updating the project's data. */
export function CampaignList({ campaigns, onCampaignsChange, onAction }: CampaignListProps) {
  const { t } = useTranslation('campaigns');
  const { handleLoadCampaign, handleLoadCampaigns, state } = useAppContext();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuFor, setMenuFor] = useState<CampaignMeta | null>(null);

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
    setMenuFor(null);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(campaign.id);
      return next;
    });
    onCampaignsChange(campaigns.filter((c) => c.id !== campaign.id));
  };

  return (
    <div className="max-w-3xl mx-auto mb-10 animate-fade-in">
      <p className="mb-3 px-1 text-xs text-gray-400 text-center">{t('listHint')}</p>
      <ul className="space-y-3">
        {campaigns.map((campaign) => (
          <li
            key={campaign.id}
            className={`px-4 py-3 bg-white border rounded-xl shadow-sm transition-colors ${
              selected.has(campaign.id) ? 'border-indigo-400 bg-indigo-50/40' : 'border-gray-200 hover:border-indigo-300'
            }`}
          >
            <div className="flex items-start gap-3">
              {campaigns.length >= 2 && (
                <button
                  onClick={() => toggleSelect(campaign.id)}
                  title={t('select')}
                  className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
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
                {campaign.monobankJar && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600">
                    <GlobeIcon className="w-3 h-3" />
                    <span className="truncate">{t('fromMonobank', { title: campaign.monobankJar.title })}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-2 sm:justify-end">
              <button
                onClick={() => setMenuFor(campaign)}
                className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors"
              >
                {t('modify')}
              </button>
              {/* the main action goes last (rightmost); full width on a phone, a sensible fixed width on desktop */}
              <button
                onClick={() => handleLoadCampaign(campaign.id, { proceed: true })}
                disabled={state.isLoading}
                className="flex-1 sm:flex-none sm:w-48 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg transition-colors"
              >
                {t('proceed')}
                <ArrowRightIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {selected.size >= 2 && (
        <button
          onClick={() => handleLoadCampaigns([...selected], { proceed: true })}
          className="mt-3 w-full px-4 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors animate-fade-in"
        >
          {t('analyzeTogether', { count: selected.size })}
          <ArrowRightIcon className="inline-block w-3.5 h-3.5 ml-1 align-middle" />
        </button>
      )}

      {menuFor && (
        <CampaignActionsSheet
          campaign={menuFor}
          onClose={() => setMenuFor(null)}
          onDelete={() => handleDelete(menuFor)}
          onAction={(action) => {
            const campaign = menuFor;
            setMenuFor(null);
            onAction(campaign, action);
          }}
        />
      )}
    </div>
  );
}
