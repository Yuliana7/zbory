import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import type { FriendJar } from '../types';
import { refreshSavedFriends, linkedOpen, staleFriends, STALE_AFTER_MS } from '../utils/friendsRefresh';
import { MonobankError, dayStartSec, estimateRequests, fetchJarStatement, statementItemsToRawDonations, updateRangeStart, type FetchProgress } from '../utils/monobankApi';
import { forgetToken, loadToken, saveToken } from '../utils/monobankToken';

const AUTO_KEY = 'zbory.friendsAutoRefresh';
/** The automatic renew tries at most this often (a failed or throttled attempt counts too). */
const AUTO_COOLDOWN_MS = 5 * 60 * 1000;
let lastAutoAttempt = 0;

const readAuto = () => {
  try {
    return localStorage.getItem(AUTO_KEY) !== '0';
  } catch {
    return true;
  }
};

export type RenewErrorKind = MonobankError['kind'] | 'unexpected';

/** How a renew went for the helper jars, and which ones it could not reach at all. */
export interface RenewReport {
  jarsUpdated: number;
  jarsFailed: number;
  rateLimited: boolean;
  /** open helpers with no linked jar: their amounts are whatever was last typed */
  manual: FriendJar[];
}

/**
 * The one way to bring a project up to date. The main jar's statement and every linked helper jar are
 * read at the same time and written once, so the two parts of the page can't drift apart and two saves
 * can't overwrite each other. A jar that was never linked can't be read: the report names those.
 *
 * With the main jar linked and no remembered token, `askToken` opens the token sheet first. On opening
 * the page the same renew runs by itself, if it can do all of it in one go; never just half.
 */
export function useRenewAll() {
  const { state, dispatch, handleMergeRows, handleFriendsChange } = useAppContext();
  const appRef = useRef(state.app);
  appRef.current = state.app;
  const { app } = state;

  const [running, setRunning] = useState(false);
  const [jarsProgress, setJarsProgress] = useState<{ done: number; total: number } | null>(null);
  const [statementProgress, setStatementProgress] = useState<FetchProgress | null>(null);
  const [error, setError] = useState<RenewErrorKind | null>(null);
  const [askToken, setAskToken] = useState(false);
  const [hasToken, setHasToken] = useState(() => !!loadToken());
  const [report, setReport] = useState<RenewReport | null>(null);
  const [auto, setAutoState] = useState(readAuto);
  const runningRef = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const abortTimer = useRef<ReturnType<typeof setTimeout>>();

  const mainJar = app.campaignDatasets ? undefined : app.monobankJar;
  const linkedJars = app.campaignDatasets ? 0 : linkedOpen(app.friends ?? []).length;

  const run = useCallback(
    async (token: string | null, quiet = false): Promise<boolean> => {
      if (runningRef.current) return false;
      const current = appRef.current;
      const friends = current.friends ?? [];
      const jar = current.campaignDatasets ? undefined : current.monobankJar;
      const from = jar && current.rawData ? updateRangeStart(current.rawData) : null;
      const readMain = !!jar && !!from && !!token;
      const readJars = linkedOpen(friends).length > 0;
      if (!readMain && !readJars) return false;

      runningRef.current = true;
      const ctl = new AbortController();
      controller.current = ctl;
      setRunning(true);
      setError(null);
      setReport(null);
      try {
        const [jars, statement] = await Promise.allSettled([
          readJars ? refreshSavedFriends(friends, { signal: ctl.signal, onProgress: setJarsProgress }) : null,
          readMain
            ? fetchJarStatement({ token: token!, jarId: jar!.id, fromSec: dayStartSec(from!), toSec: Math.floor(Date.now() / 1000), onProgress: setStatementProgress, signal: ctl.signal })
            : null,
        ]);
        const jarResult = jars.status === 'fulfilled' ? jars.value : null;
        const nextFriends = jarResult && jarResult.updated > 0 ? jarResult.friends : undefined;

        // one write for everything that came back
        if (statement.status === 'fulfilled' && statement.value) {
          await handleMergeRows(statementItemsToRawDonations(statement.value), { syncedAt: Date.now(), friends: nextFriends, quiet });
        } else if (nextFriends) {
          await handleFriendsChange(nextFriends);
        }

        if (statement.status === 'rejected' && !ctl.signal.aborted) {
          const kind: RenewErrorKind = statement.reason instanceof MonobankError ? statement.reason.kind : 'unexpected';
          setError(kind);
          if (kind === 'invalid-token') {
            forgetToken();
            setHasToken(false);
            setAskToken(true);
          }
        }
        if (!quiet && !ctl.signal.aborted) {
          setReport({
            jarsUpdated: jarResult?.updated ?? 0,
            jarsFailed: jarResult?.failed ?? 0,
            rateLimited: jarResult?.rateLimited ?? false,
            manual: (nextFriends ?? friends).filter((f) => !f.jarId && !f.closed && (f.raised > 0 || (f.target ?? 0) > 0)),
          });
        }
        return !ctl.signal.aborted;
      } finally {
        runningRef.current = false;
        controller.current = null;
        setRunning(false);
        setJarsProgress(null);
        setStatementProgress(null);
      }
    },
    [handleMergeRows, handleFriendsChange],
  );

  const renew = useCallback(() => {
    const needsToken = !!appRef.current.monobankJar && !appRef.current.campaignDatasets;
    const saved = loadToken();
    if (needsToken && !saved) setAskToken(true);
    else void run(saved);
  }, [run]);

  const submitToken = useCallback(
    (token: string, remember: boolean) => {
      if (remember) {
        saveToken(token);
        setHasToken(true);
      }
      setAskToken(false);
      void run(token.trim());
    },
    [run],
  );

  const stop = useCallback(() => controller.current?.abort(), []);

  const forget = useCallback(() => {
    forgetToken();
    setHasToken(false);
  }, []);

  const setAuto = useCallback((on: boolean) => {
    setAutoState(on);
    try {
      localStorage.setItem(AUTO_KEY, on ? '1' : '0');
    } catch {
      /* private mode: the choice just lasts until reload */
    }
  }, []);

  // In timers, so StrictMode's trial unmount cancels them instead of sending rate-limited requests twice.
  // «Оновити з Monobank» in the project list lands here and starts right away.
  const requested = !!app.renewRequested;
  useEffect(() => {
    if (!requested) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'RENEW_REQUESTED', payload: false });
      renew();
    }, 0);
    return () => clearTimeout(timer);
  }, [requested, renew, dispatch]);

  // On arrival: if something has gone stale and the whole project can be renewed in a single request.
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = appRef.current;
      const now = Date.now();
      if (!auto || current.renewRequested || current.campaignDatasets || now - lastAutoAttempt < AUTO_COOLDOWN_MS) return;
      const friends = current.friends ?? [];
      if (linkedOpen(friends).length === 0) return;
      const jar = current.monobankJar;
      const token = loadToken();
      if (jar) {
        const from = current.rawData ? updateRangeStart(current.rawData) : null;
        if (!token || !from || estimateRequests(dayStartSec(from), Math.floor(now / 1000)) > 1) return;
      }
      const stale = staleFriends(friends, now).length > 0 || (!!jar && now - (current.monobankSyncedAt ?? 0) > STALE_AFTER_MS);
      if (!stale) return;
      void run(token, true).then((completed) => {
        if (completed) lastAutoAttempt = Date.now(); // leaving the page aborts the run, and that is not an attempt
      });
    }, 0);
    return () => clearTimeout(timer);
    // only when the page opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // leaving the page stops reading (after a beat, so a remount can keep it going)
  useEffect(() => {
    clearTimeout(abortTimer.current);
    return () => {
      abortTimer.current = setTimeout(() => controller.current?.abort(), 100);
    };
  }, []);

  return {
    /** there is something to renew here */
    available: !!mainJar || linkedJars > 0,
    mainLinked: !!mainJar,
    linkedJars,
    renew,
    running,
    jarsProgress,
    statementProgress,
    error,
    report,
    dismissReport: () => setReport(null),
    askToken,
    closeTokenSheet: () => setAskToken(false),
    submitToken,
    stop,
    hasToken,
    forget,
    auto,
    setAuto,
  };
}

export type RenewAll = ReturnType<typeof useRenewAll>;
