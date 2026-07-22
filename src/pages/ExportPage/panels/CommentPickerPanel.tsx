import { useTranslation } from 'react-i18next';
import { Collapsible } from '../shared';

interface PersonalComment {
  text: string;
  donor?: string;
}

interface CommentPickerPanelProps {
  open: boolean;
  onToggle: () => void;
  personalComments: PersonalComment[];
  selectedKeys: string[];
  selectedCount: number;
  onToggleComment: (text: string) => void;
}

export function CommentPickerPanel({ open, onToggle, personalComments, selectedKeys, selectedCount, onToggleComment }: CommentPickerPanelProps) {
  const { t } = useTranslation('export');
  return (
    <Collapsible
      label={t('commentPicker.label')}
      badge={`${selectedCount}/5`}
      badgeColor="indigo"
      open={open}
      onToggle={onToggle}
    >
      {personalComments.length === 0 ? (
        <p className="text-xs text-gray-400">{t('commentPicker.empty')}</p>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-2">{t('commentPicker.hint')}</p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {personalComments.map((c) => {
              const checked = selectedKeys.includes(c.text);
              const disabled = !checked && selectedCount >= 5;
              return (
                <label
                  key={c.text}
                  className={`flex items-start gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onToggleComment(c.text)}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <span className="min-w-0">
                    <span className="text-gray-800 break-words">{c.text}</span>
                    {c.donor && <span className="text-gray-400"> — {c.donor}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </Collapsible>
  );
}
