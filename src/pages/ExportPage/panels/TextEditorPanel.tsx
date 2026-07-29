import { useTranslation } from 'react-i18next';
import type { TemplateType } from '../../../types';
import type { TextFieldDef } from '../../../utils/templateConfig';
import { Collapsible } from '../shared';

interface TextEditorPanelProps {
  open: boolean;
  onToggle: () => void;
  templateId: TemplateType;
  textFields: TextFieldDef[];
  textOverrides: Record<string, string>;
  onSetOverride: (key: string, value: string) => void;
  onReset: () => void;
  defaultFor: (key: string) => string;
}

export function TextEditorPanel({ open, onToggle, templateId, textFields, textOverrides, onSetOverride, onReset, defaultFor }: TextEditorPanelProps) {
  const { t } = useTranslation('export');
  return (
    <Collapsible label={t('textEditor.label')} open={open} onToggle={onToggle}>
      <div className="space-y-3">
        {textFields.map((field) => {
          const currentValue = textOverrides[field.key] ?? defaultFor(field.key);
          const setOverride = (value: string) => onSetOverride(field.key, value);
          return (
            <div key={field.key}>
              <label className="block text-xs text-gray-500 mb-1">{t(`fieldLabels.${templateId}.${field.key}`)}</label>
              {field.multiline ? (
                <textarea value={currentValue} onChange={e => setOverride(e.target.value)} placeholder={t('textEditor.defaultPlaceholder')} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
              ) : (
                <input type="text" value={currentValue} onChange={e => setOverride(e.target.value)} placeholder={t('textEditor.defaultPlaceholder')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              )}
            </div>
          );
        })}
        {Object.keys(textOverrides).length > 0 && (
          <button onClick={onReset} className="text-xs text-gray-400 hover:text-gray-600 underline">{t('textEditor.reset')}</button>
        )}
      </div>
    </Collapsible>
  );
}
