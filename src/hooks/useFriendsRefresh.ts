import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import type { FriendJar } from '../types';
import { refreshSavedFriends, staleFriends, type RefreshResult } from '../utils/friendsRefresh';

const AUTO_KEY = 'zbory.friendsAutoRefresh';
/** The automatic refresh tries at most this often (a failed or throttled attempt counts too). */
const AUTO_COOLDOWN_MS = 5 * 60 * 1000;
let lastAutoAttempt = 0;

const readAuto = () => {
  try {
    return localStorage.getItem(AUTO_KEY) !== '0';
  } catch {
    return true;
  }
};

export type RefreshOutcome = Omit<RefreshResult, 'friends'>;

/**
 * Keeps the helper jars of the open project fresh, for the read-only analytics view.
 *
 * - `refreshNow` reads every linked open jar (the «Оновити» button).
 * - With `auto` on (default; remembered on this device), opening the page reads the linked open jars
 *   whose data is older than 15 minutes — never more often than every 5 minutes, one request a second.
 * Results are saved with the project through the same path as an edit (`handleFriendsChange`).
 */
export function useFriendsRefresh(friends: FriendJar[]) {
  const { handleFriendsChange } = useAppContext();
  const friendsRef = useRef(friends);
  friendsRef.current = friends;

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; current?: string } | null>(null);
  const [outcome, setOutcome] = useState<RefreshOutcome | null>(null);
  const [auto, setAutoState] = useState(readAuto);
  const runningRef = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const abortTimer = useRef<ReturnType<typeof setTimeout>>();

  const run = useCallback(
    async (only?: (f: FriendJar) => boolean) => {
      if (runningRef.current) return;
      runningRef.current = true;
      const ctl = new AbortController();
      controller.current = ctl;
      setRunning(true);
      setOutcome(null);
      try {
        const { friends: next, ...rest } = await refreshSavedFriends(friendsRef.current, {
          only,
          signal: ctl.signal,
          onProgress: (p) => setProgress(p.current ? p : null),
        });
        if (rest.updated > 0) handleFriendsChange(next);
        if (!ctl.signal.aborted) setOutcome(rest);
        return !ctl.signal.aborted;
      } finally {
        runningRef.current = false;
        controller.current = null;
        setRunning(false);
        setProgress(null);
      }
    },
    [handleFriendsChange],
  );

  const refreshNow = useCallback(() => void run(), [run]);

  const setAuto = useCallback((on: boolean) => {
    setAutoState(on);
    try {
      localStorage.setItem(AUTO_KEY, on ? '1' : '0');
    } catch {
      /* private mode: the choice just lasts until reload */
    }
  }, []);

  // on arrival: read what has gone stale
  useEffect(() => {
    clearTimeout(abortTimer.current); // StrictMode's fake unmount/remount: carry on with the run that is going
    const now = Date.now();
    if (!auto || now - lastAutoAttempt < AUTO_COOLDOWN_MS) return;
    const stale = new Set(staleFriends(friendsRef.current, now).map((f) => f.id));
    if (stale.size === 0) return;
    void run((f) => stale.has(f.id)).then((completed) => {
      // leaving the page aborts the run, and that is not an attempt
      if (completed) lastAutoAttempt = Date.now();
    });
    return undefined;
    // only when the page opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // leaving the page stops reading (after a beat, so a remount can keep it going)
  useEffect(
    () => () => {
      abortTimer.current = setTimeout(() => controller.current?.abort(), 100);
    },
    [],
  );

  return { running, progress, outcome, auto, setAuto, refreshNow };
}
