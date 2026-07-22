import { useTranslation } from 'react-i18next';
import { Collapsible } from '../shared';

interface GoalPanelProps {
  open: boolean;
  onToggle: () => void;
  goal: string;
  onGoalChange: (v: string) => void;
  requiresGoal: boolean;
}

export function GoalPanel({ open, onToggle, goal, onGoalChange, requiresGoal }: GoalPanelProps) {
  const { t } = useTranslation('export');
  return (
    <Collapsible label={t('goal.label')} open={open} onToggle={onToggle}>
      <div className="relative">
        <input
          type="text"
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          placeholder={t('goal.placeholder')}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₴</span>
      </div>
      <p className="mt-1.5 text-xs text-gray-400">{t('goal.hint')}</p>
      {requiresGoal && !goal && <p className="mt-1 text-xs text-red-500">{t('requiredField')}</p>}
    </Collapsible>
  );
}
