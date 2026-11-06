import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../../context/AppContext';
import { ScreenShell } from './ScreenShell';

/** «Редагувати» → «Перейменувати»: the saved project's name. */
export function RenameScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation('upload');
  const { t: tCamp } = useTranslation('campaigns');
  const { state, handleSaveCampaign } = useAppContext();
  const [name, setName] = useState(state.app.activeCampaignName ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const meta = await handleSaveCampaign(name);
    setSaving(false);
    if (meta) onDone();
  };

  return (
    <ScreenShell title={tCamp('actions.rename')} backLabel={t('focus.back')} onBack={onDone}>
      <label className="block">
        <span className="block text-sm font-semibold text-gray-900 mb-1">{tCamp('renameLabel')}</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          autoFocus
          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </label>
      <div className="mt-5 flex gap-2">
        <button onClick={save} disabled={!name.trim() || saving} className="btn-primary flex-1 disabled:opacity-50">
          {t('focus.save')}
        </button>
        <button onClick={onDone} className="btn-secondary">
          {t('focus.cancel')}
        </button>
      </div>
    </ScreenShell>
  );
}
