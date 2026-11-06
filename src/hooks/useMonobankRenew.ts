import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { MonobankError, dayStartSec, fetchJarStatement, statementItemsToRawDonations, updateRangeStart, type FetchProgress } from '../utils/monobankApi';
import { forgetToken, loadToken, saveToken } from '../utils/monobankToken';

export type RenewErrorKind = MonobankError['kind'] | 'unexpected';

/**
 * Brings the open project up to date from its Monobank jar: from the day of the newest saved row until
 * now, merged and saved with no steps in between. With a remembered token that is one tap; without
 * one, `askToken` opens the token sheet and `submitToken` carries on. A token Monobank rejects is forgotten.
 */
export function useMonobankRenew() {
  const { state, handleMergeRows } = useAppContext();
  const { app } = state;
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [error, setError] = useState<RenewErrorKind | null>(null);
  const [askToken, setAskToken] = useState(false);
  const [hasToken, setHasToken] = useState(() => !!loadToken());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const read = useCallback(
    async (token: string) => {
      const jar = app.monobankJar;
      const from = app.rawData ? updateRangeStart(app.rawData) : null;
      if (!jar || !from) return;
      const abort = new AbortController();
      abortRef.current = abort;
      setError(null);
      setProgress(null);
      setRunning(true);
      try {
        const now = Math.floor(Date.now() / 1000);
        const items = await fetchJarStatement({ token, jarId: jar.id, fromSec: dayStartSec(from), toSec: now, onProgress: setProgress, signal: abort.signal });
        await handleMergeRows(statementItemsToRawDonations(items), { syncedAt: Date.now() });
      } catch (err) {
        if (abort.signal.aborted) return;
        const kind: RenewErrorKind = err instanceof MonobankError ? err.kind : 'unexpected';
        setError(kind);
        if (kind === 'invalid-token') {
          forgetToken();
          setHasToken(false);
          setAskToken(true);
        }
      } finally {
        setRunning(false);
        setProgress(null);
      }
    },
    [app.monobankJar, app.rawData, handleMergeRows],
  );

  const renew = useCallback(() => {
    const saved = loadToken();
    if (saved) void read(saved);
    else setAskToken(true);
  }, [read]);

  const submitToken = useCallback(
    (token: string, remember: boolean) => {
      if (remember) {
        saveToken(token);
        setHasToken(true);
      }
      setAskToken(false);
      void read(token.trim());
    },
    [read],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const forget = useCallback(() => {
    forgetToken();
    setHasToken(false);
  }, []);

  return { renew, running, progress, error, askToken, closeTokenSheet: () => setAskToken(false), submitToken, stop, hasToken, forget };
}
