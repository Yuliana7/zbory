import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listCampaigns, type CampaignMeta } from '../../utils/campaignStore';
import { renewProjects, renewableProjects, type ProjectsRenewProgress, type ProjectsRenewResult } from '../../utils/renewProjects';
import { forgetToken, loadToken, saveToken } from '../../utils/monobankToken';
import { REQUEST_GAP_SECONDS } from '../../utils/monobankApi';
import { isArchived } from '../../utils/archive';
import { RenewTokenSheet } from '../insights/RenewTokenSheet';
import { CountdownRing } from './CountdownRing';
import { RefreshIcon, SpinnerIcon } from '../../icons';

/** «Оновити все з Monobank» over the projects: each linked main jar's statement in turn (Monobank allows
 * one a minute), with where it is and how long it waits; then what came in. */
export function RenewProjectsBar({ campaigns, onCampaignsChange }: { campaigns: CampaignMeta[]; onCampaignsChange: (campaigns: CampaignMeta[]) => void }) {
  const { t } = useTranslation('campaigns');
  const { t: tUpload } = useTranslation('upload');
  const [progress, setProgress] = useState<ProjectsRenewProgress | null>(null);
  const [result, setResult] = useState<ProjectsRenewResult | null>(null);
  const [askToken, setAskToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => () => ctl.current?.abort(), []);

  const count = renewableProjects(campaigns).length;
  if (count === 0) return null;

  const run = async (token: string) => {
    const controller = new AbortController();
    ctl.current = controller;
    setResult(null);
    setProgress({ index: 0, total: count, name: '', fetch: null });
    const res = await renewProjects(campaigns, token, { signal: controller.signal, onProgress: setProgress });
    setProgress(null);
    ctl.current = null;
    onCampaignsChange((await listCampaigns()).filter((c) => !isArchived(c)));
    if (res.tokenRefused) {
      forgetToken();
      setTokenError(tUpload('monobank.errors.invalid-token'));
      setAskToken(true);
    }
    if (!controller.signal.aborted) setResult(res);
  };

  const start = () => {
    const saved = loadToken();
    if (saved) void run(saved);
    else setAskToken(true);
  };

  const waiting = progress?.fetch?.waitSeconds ?? 0;
  return (
    <div className="mb-3 px-1 text-xs text-gray-500" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          {progress ? (
            <>
              {waiting > 0 ? <CountdownRing secondsLeft={waiting} totalSeconds={REQUEST_GAP_SECONDS} className="h-4 w-4 shrink-0" /> : null}
              {progress.name ? t('renewAll.reading', { name: progress.name, n: progress.index + 1, total: progress.total }) : t('renewAll.starting')}
              {waiting > 0 && ` · ${t('renewAll.waiting', { seconds: waiting })}`}
            </>
          ) : (
            t('renewAll.hint', { count })
          )}
        </span>
        <button
          onClick={progress ? () => ctl.current?.abort() : start}
          className="flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          {progress ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : <RefreshIcon className="h-3.5 w-3.5" />}
          {progress ? t('renewAll.stop') : t('renewAll.button')}
        </button>
      </div>
      {result && (
        <div role="status" className="mt-1.5 space-y-0.5">
          {result.updated.length > 0 && <p className="text-green-700">{t('renewAll.updated', { names: result.updated.map((u) => `${u.name} (+${u.added})`).join(', ') })}</p>}
          {result.updated.length === 0 && result.failed.length === 0 && !result.tokenRefused && <p>{t('renewAll.nothingNew')}</p>}
          {result.failed.length > 0 && <p className="text-amber-700">{t('renewAll.failed', { names: result.failed.map((f) => f.name).join(', ') })}</p>}
        </div>
      )}
      {askToken && (
        <RenewTokenSheet
          error={tokenError}
          onSubmit={(token, remember) => {
            if (remember) saveToken(token);
            setAskToken(false);
            setTokenError(null);
            void run(token.trim());
          }}
          onClose={() => {
            setAskToken(false);
            setTokenError(null);
          }}
        />
      )}
    </div>
  );
}
