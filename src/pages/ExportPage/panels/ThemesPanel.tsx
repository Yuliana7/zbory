import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SharedStyle } from '../../../types';
import { saveTheme, updateTheme, listThemes, deleteTheme, type ThemeRecord } from '../../../utils/themeStore';
import { Collapsible } from '../shared';
import { CheckIcon, PlusIcon, TrashIcon } from '../../../icons';

interface ThemesPanelProps {
  open: boolean;
  onToggle: () => void;
  style: SharedStyle;
  onApplyTheme: (theme: ThemeRecord) => void;
}

const swatchBg = (s: SharedStyle): React.CSSProperties =>
  s.bgImage
    ? { backgroundImage: `url(${s.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: s.palette.background };

/** Named, reusable style presets — save the current look once, switch
 * between saved looks across any campaign. Snapshot semantics: applying a
 * theme copies its style; editing/deleting a theme never changes a campaign
 * that already applied it. */
export function ThemesPanel({ open, onToggle, style, onApplyTheme }: ThemesPanelProps) {
  const { t } = useTranslation('export');
  const [themes, setThemes] = useState<ThemeRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');

  const load = () => {
    listThemes().then(setThemes);
  };
  useEffect(() => {
    load();
  }, []);

  const activeTheme = themes.find((th) => th.id === style.themeId);

  // the theme this look started from: changing it afterwards offers to update that theme
  const baseTheme = themes.find((th) => th.id === style.baseThemeId);
  const modified = !!baseTheme && style.themeId !== baseTheme.id;

  const handleUpdate = async () => {
    if (!baseTheme) return;
    const updated = await updateTheme(baseTheme.id, style);
    load();
    if (updated) onApplyTheme(updated);
  };

  const handleDelete = async (theme: ThemeRecord) => {
    if (!window.confirm(t('themes.deleteConfirm', { name: theme.name }))) return;
    await deleteTheme(theme.id);
    load();
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const theme = await saveTheme({ name, style });
    setSaving(false);
    setName('');
    load();
    onApplyTheme(theme);
  };

  return (
    <Collapsible label={t('themes.label')} badge={activeTheme?.name} badgeColor="indigo" open={open} onToggle={onToggle}>
      <div className="space-y-3">
        {themes.length === 0 ? (
          <p className="text-xs text-gray-400">{t('themes.empty')}</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {themes.map((theme) => {
              const isActive = theme.id === style.themeId;
              return (
                <div key={theme.id} className="flex flex-col items-center gap-1 shrink-0 w-16">
                  <button
                    onClick={() => onApplyTheme(theme)}
                    title={theme.name}
                    className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                      isActive ? 'ring-2 ring-indigo-500 ring-offset-1 scale-105 border-indigo-500' : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={swatchBg(theme.style)}
                  >
                    {isActive && (
                      <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center">
                        <CheckIcon className="w-2.5 h-2.5 text-indigo-600" />
                      </span>
                    )}
                  </button>
                  <p className="text-[11px] text-gray-500 truncate max-w-full">{theme.name}</p>
                  <button
                    onClick={() => handleDelete(theme)}
                    title={t('themes.delete')}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {baseTheme && (
          <div className="space-y-1">
            <button
              onClick={handleUpdate}
              disabled={!modified}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                         bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-default"
            >
              <CheckIcon className="w-3.5 h-3.5" />
              {t('themes.updateCurrent', { name: baseTheme.name })}
            </button>
            <p className="text-xs text-gray-400">{modified ? t('themes.updateHint') : t('themes.updateNothing')}</p>
          </div>
        )}

        {saving ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={t('themes.namePlaceholder')}
              autoFocus
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-base text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700
                         disabled:opacity-40 text-white rounded-lg transition-colors"
            >
              {t('themes.confirmSave')}
            </button>
            <button
              onClick={() => setSaving(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
            >
              {t('themes.cancel')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSaving(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg
                       bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            {t('themes.saveCurrent')}
          </button>
        )}
      </div>
    </Collapsible>
  );
}
