import { useTranslation } from 'react-i18next';
import { CheckIcon } from '../../icons';

/** A closed jar's goal outcome, as a status: from its numbers when it had a goal, else from what the user
 * said when it was closed. Nothing when neither is known. */
export function GoalStatusPill({ reached }: { reached: boolean | undefined }) {
  const { t } = useTranslation('archive');
  if (reached === undefined) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        reached ? 'bg-green-50 text-green-800 ring-1 ring-inset ring-green-200' : 'bg-gray-100 text-gray-700'
      }`}
    >
      {reached && <CheckIcon className="h-3.5 w-3.5" />}
      {reached ? t('goalStatus.reached') : t('goalStatus.notReached')}
    </span>
  );
}
