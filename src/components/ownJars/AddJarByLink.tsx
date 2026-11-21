import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OwnJar } from '../../types';
import { addOwnJar, attachJarLink, likelySameAsTied, listOwnJars, saveOwnJar } from '../../utils/ownJars';
import { isArchived } from '../../utils/archive';
import { fmtUah } from '../../utils/friendJars';
import { PlusIcon, SpinnerIcon } from '../../icons';

/** «Дружня банка за посиланням»: a friendly jar read from its public link — the user's own one, or one
 * they follow. When it is probably a jar already added through the user's token (same name and goal, no
 * link yet), the user picks: merge (the link joins that jar) or keep it separate. */
export function AddJarByLink({ onAdded }: { onAdded: () => void }) {
  const { t } = useTranslation('upload');
  const { t: tExport } = useTranslation('export');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [same, setSame] = useState<{ read: OwnJar; known: OwnJar } | null>(null);

  const add = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    const all = await listOwnJars();
    const res = await addOwnJar(text, all);
    if ('error' in res) {
      setBusy(false);
      setError(tExport(`friends.jarErrors.${res.error}`));
      return;
    }
    const known = all.find((j) => !isArchived(j) && likelySameAsTied(res.jar, j));
    if (known) {
      setBusy(false);
      setSame({ read: res.jar, known });
      return;
    }
    await saveOwnJar(res.jar);
    setBusy(false);
    onAdded();
  };

  const decide = async (merge: boolean) => {
    if (!same) return;
    setBusy(true);
    if (merge) {
      // the link joins the jar known through the token: its name and official numbers stay
      const res = await attachJarLink(same.known, input.trim(), await listOwnJars());
      if ('error' in res) {
        setBusy(false);
        setError(tExport(`friends.jarErrors.${res.error}`));
        setSame(null);
        return;
      }
      await saveOwnJar(res.jar);
    } else await saveOwnJar(same.read);
    setBusy(false);
    setSame(null);
    onAdded();
  };

  if (same) {
    return (
      <div role="group" aria-label={t('addJars.sameTitle')} className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-3">
        <p className="font-semibold">{t('addJars.sameTitle')}</p>
        <p>{t('byLink.sameText', { name: same.known.name, raised: fmtUah(same.known.raised) })}</p>
        <div className="flex flex-col gap-2">
          <button onClick={() => void decide(true)} disabled={busy} className="btn-primary">
            {t('byLink.merge', { name: same.known.name })}
          </button>
          <button onClick={() => void decide(false)} disabled={busy} className="btn-secondary">
            {t('addJars.separate')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          placeholder="send.monobank.ua/jar/…"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={t('ownJars.placeholder')}
          className="min-w-0 flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-gray-400"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white text-sm font-semibold transition-colors"
        >
          {busy ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : <PlusIcon className="w-4 h-4" />}
          {t('ownJars.add')}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-1.5 px-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
