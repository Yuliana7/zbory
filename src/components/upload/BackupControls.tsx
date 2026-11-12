import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { saveBlob } from '../../utils/download';
import { buildBackup, listCampaigns, parseBackup, restoreBackup, type CampaignMeta } from '../../utils/campaignStore';

const KEY = 'zbory.lastBackupAt';

const readLast = () => {
  try {
    return Number(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
};

/** One file with every project, to keep elsewhere or move to another device. It is what protects
 * the helper jars' history, which Monobank can't give back. */
export function BackupControls({ hasProjects, onRestored, onJarsRestored }: { hasProjects: boolean; onRestored: (campaigns: CampaignMeta[]) => void; onJarsRestored?: () => void }) {
  const { t } = useTranslation('campaigns');
  const inputRef = useRef<HTMLInputElement>(null);
  const [last, setLast] = useState(readLast);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  const create = async () => {
    setMessage(null);
    try {
      const now = Date.now();
      const backup = await buildBackup(now);
      const day = new Date(now).toLocaleDateString('sv-SE');
      await saveBlob(new Blob([JSON.stringify(backup)], { type: 'application/json' }), `zbory-backup-${day}.json`);
      setLast(now);
      try {
        localStorage.setItem(KEY, String(now));
      } catch {
        /* only the note is lost */
      }
    } catch {
      setMessage({ text: t('backup.failed'), bad: true });
    }
  };

  const restore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMessage(null);
    const backup = parseBackup(await file.text());
    if (!backup) {
      setMessage({ text: t('backup.invalid'), bad: true });
      return;
    }
    const result = await restoreBackup(backup);
    onRestored(await listCampaigns());
    const jars = result.ownJars > 0 ? ` · ${t('backup.restoredJars', { n: result.ownJars })}` : '';
    setMessage({ text: t('backup.restored', { ...result }) + jars, bad: false });
    onJarsRestored?.();
  };

  const link = 'font-medium text-indigo-600 hover:text-indigo-800 transition-colors';
  return (
    <div className="max-w-3xl mx-auto mt-8 pt-5 border-t border-gray-200 text-center text-xs text-gray-500 space-y-2">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {hasProjects && <button onClick={create} className={link}>{t('backup.create')}</button>}
        <button onClick={() => inputRef.current?.click()} className={link}>{t('backup.restore')}</button>
        <input ref={inputRef} type="file" accept=".json,application/json" onChange={restore} className="hidden" />
      </div>
      {hasProjects && <p>{last ? t('backup.last', { when: new Date(last).toLocaleDateString('uk-UA') }) : t('backup.never')} · {t('backup.hint')}</p>}
      {message && <p role="status" className={message.bad ? 'text-red-600' : 'text-green-700'}>{message.text}</p>}
    </div>
  );
}
