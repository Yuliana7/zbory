import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EditIcon } from '../../icons';

/** An archived jar's name, with «Перейменувати»: names that came from a file («Jar_statement_…») can be
 * made readable. Saved on «Зберегти» or Enter; Escape or «Скасувати» leaves it. */
export function EditableTitle({ name, onRename, className }: { name: string; onRename: (name: string) => Promise<void>; className: string }) {
  const { t } = useTranslation('archive');
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (draft === null) {
    return (
      <div className="flex items-start gap-2">
        <h2 className={`min-w-0 flex-1 ${className}`}>{name || '—'}</h2>
        <button
          onClick={() => setDraft(name)}
          title={t('rename.button')}
          aria-label={t('rename.button')}
          className="mt-1 shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
        >
          <EditIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const save = async () => {
    const clean = draft.trim();
    if (!clean || clean === name) return setDraft(null);
    setSaving(true);
    await onRename(clean);
    setSaving(false);
    setDraft(null);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-2"
    >
      <label className="block">
        <span className="sr-only">{t('import.name')}</span>
        <input
          autoFocus
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setDraft(null)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base font-semibold text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={saving || !draft.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
          {t('rename.save')}
        </button>
        <button type="button" onClick={() => setDraft(null)} disabled={saving} className="btn-secondary px-4 py-2 text-sm">
          {t('close.cancel')}
        </button>
      </div>
    </form>
  );
}
