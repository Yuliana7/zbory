import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../../context/AppContext';
import { parseGoal } from '../../../utils/goal';
import { GoalField } from '../preview/GoalField';
import { ScreenShell } from './ScreenShell';

/** «Змінити» → «Мета збору»: just the goal of a saved project. Saving writes it to the library. */
export function GoalScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation('upload');
  const { state, handleSaveCampaign } = useAppContext();
  const { app } = state;
  const [value, setValue] = useState(app.goal ? String(app.goal) : '');
  const [saving, setSaving] = useState(false);
  const goal = parseGoal(value);
  const invalid = value.trim() !== '' && goal === null;

  const save = async () => {
    if (invalid || !app.activeCampaignName) return;
    setSaving(true);
    // an emptied field clears the goal (null), not "keep the old one"
    const meta = await handleSaveCampaign(app.activeCampaignName, goal);
    setSaving(false);
    if (meta) onDone();
  };

  return (
    <ScreenShell title={t('preview.goal.label')} backLabel={t('focus.back')} onBack={onDone}>
      <GoalField value={value} onChange={setValue} invalid={invalid} />
      <div className="mt-5 flex gap-2">
        <button onClick={save} disabled={invalid || saving} className="btn-primary flex-1 disabled:opacity-50">
          {t('focus.save')}
        </button>
        <button onClick={onDone} className="btn-secondary">
          {t('focus.cancel')}
        </button>
      </div>
    </ScreenShell>
  );
}
