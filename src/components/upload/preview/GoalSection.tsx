import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../../utils/dataAggregator';
import { parseGoal } from '../../../utils/goal';
import { CollapsibleSection } from './CollapsibleSection';
import { GoalField } from './GoalField';

interface GoalSectionProps {
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onToggle: () => void;
}

export function GoalSection({ value, onChange, open, onToggle }: GoalSectionProps) {
  const { t } = useTranslation('upload');
  const goal = parseGoal(value);
  return (
    <CollapsibleSection
      title={
        <>
          {t('preview.goal.label')} <span className="text-sm font-normal text-gray-500">{t('preview.goal.optional')}</span>
        </>
      }
      summary={goal ? formatCurrency(goal) : t('preview.goal.notSet')}
      open={open}
      onToggle={onToggle}
    >
      <GoalField value={value} onChange={onChange} invalid={value.trim() !== '' && goal === null} />
    </CollapsibleSection>
  );
}
