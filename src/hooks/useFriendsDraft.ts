import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useAppContext } from '../context/AppContext';
import {
  applyJarInfo,
  duplicateNameIds,
  friendNameKey,
  friendsDiffer,
  friendsToRows,
  newFriend,
  rowsToFriends,
  type FriendDraftRow,
} from '../utils/friendJars';
import { JarError, fetchPublicJar, parseJarId, type JarErrorKind } from '../utils/monobankJar';

/** Pause between two reads when several jars are refreshed — the endpoint is throttled. */
const REFRESH_GAP_MS = 1000;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const kindOf = (err: unknown): JarErrorKind => (err instanceof JarError ? err.kind : 'unexpected');

export interface RefreshSummary {
  updated: number;
  failed: number;
  /** stopped early because Monobank said "too many requests" */
  rateLimited: boolean;
}

/** What is typed into the helper-jar editor, kept apart from what is saved: nothing reaches the
 * app (and the cards) until `save()`, and `dirty` says whether leaving would lose something.
 *
 * Reading a linked jar from Monobank (`refreshOne`, `refreshAll`, `linkJar`, `addByIds`) goes through
 * the same draft. If the form had no unsaved edits when the read started, the result is saved right
 * away — a plain refresh is one tap and sticks; if there were edits, they and the result wait for «Зберегти». */
export function useFriendsDraft() {
  const { state, handleFriendsChange } = useAppContext();
  const saved = state.app.friends;
  const savedRef = useRef(saved);
  savedRef.current = saved;

  const [rows, setRowsState] = useState<FriendDraftRow[]>(() => friendsToRows(saved));
  // the newest rows, readable from async code that started before the latest render
  const rowsRef = useRef(rows);
  const setRows: Dispatch<SetStateAction<FriendDraftRow[]>> = useCallback((update) => {
    const next = typeof update === 'function' ? update(rowsRef.current) : update;
    rowsRef.current = next;
    setRowsState(next);
  }, []);

  const dirty = friendsDiffer(rows, saved);
  const duplicates = duplicateNameIds(rows);

  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, JarErrorKind>>({});
  const [summary, setSummary] = useState<RefreshSummary | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const persist = useCallback(
    (list: FriendDraftRow[]) => {
      const clean = rowsToFriends(list, savedRef.current);
      handleFriendsChange(clean);
      savedRef.current = clean; // the next save in the same tick compares against this
      return clean;
    },
    [handleFriendsChange],
  );

  /** false (and nothing stored) while two helpers share a name */
  const save = useCallback((): boolean => {
    if (duplicateNameIds(rowsRef.current).size > 0) return false;
    const clean = persist(rowsRef.current);
    setRows(friendsToRows(clean)); // drop blank rows from the form too
    return true;
  }, [persist, setRows]);

  const discard = useCallback(() => setRows(friendsToRows(savedRef.current)), [setRows]);

  const setBusy = (id: string, on: boolean) => setBusyIds((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)));
  const setRowError = (id: string, kind?: JarErrorKind) =>
    setRowErrors((errs) => {
      const next = { ...errs };
      if (kind) next[id] = kind;
      else delete next[id];
      return next;
    });

  /** Writes a read jar into its row (and clears that row's error). */
  const applyRead = (id: string, jar: Parameters<typeof applyJarInfo>[1]) => {
    setRows((rs) => rs.map((r) => (r.id === id ? applyJarInfo(r, jar, Date.now()) : r)));
    setRowError(id);
  };

  const finish = (autoSave: boolean) => {
    if (autoSave && alive.current && duplicateNameIds(rowsRef.current).size === 0) {
      persist(rowsRef.current);
      setRows(friendsToRows(savedRef.current));
    }
  };

  /** Reads one linked, still-open jar. */
  const refreshOne = useCallback(
    async (id: string): Promise<JarErrorKind | null> => {
      const row = rowsRef.current.find((r) => r.id === id);
      if (!row?.jarId || row.closed) return null;
      const autoSave = !friendsDiffer(rowsRef.current, savedRef.current);
      setBusy(id, true);
      try {
        applyRead(id, await fetchPublicJar(row.jarId));
        finish(autoSave);
        return null;
      } catch (err) {
        const kind = kindOf(err);
        setRowError(id, kind);
        return kind;
      } finally {
        if (alive.current) setBusy(id, false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** Reads every linked, still-open jar one after another; stops at the first "too many requests". */
  const refreshAll = useCallback(async () => {
    const todo = rowsRef.current.filter((r) => r.jarId && !r.closed).map((r) => ({ id: r.id, jarId: r.jarId! }));
    if (todo.length === 0) return;
    const autoSave = !friendsDiffer(rowsRef.current, savedRef.current);
    const result: RefreshSummary = { updated: 0, failed: 0, rateLimited: false };
    setSummary(null);
    setProgress({ done: 0, total: todo.length });
    for (let i = 0; i < todo.length && alive.current; i++) {
      if (i > 0) await sleep(REFRESH_GAP_MS);
      const { id, jarId } = todo[i];
      setBusy(id, true);
      try {
        applyRead(id, await fetchPublicJar(jarId));
        result.updated++;
      } catch (err) {
        const kind = kindOf(err);
        setRowError(id, kind);
        result.failed++;
        if (kind === 'rate-limit') {
          result.rateLimited = true;
          if (alive.current) setBusy(id, false);
          break;
        }
      }
      if (alive.current) {
        setBusy(id, false);
        setProgress({ done: i + 1, total: todo.length });
      }
    }
    finish(autoSave);
    if (alive.current) {
      setProgress(null);
      setSummary(result);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Links a row to a helper's jar by its long id and reads it. Resolves to an error kind, or null on success. */
  const linkJar = useCallback(
    async (id: string, input: string): Promise<JarErrorKind | 'invalid' | 'duplicate' | null> => {
      const jarId = parseJarId(input);
      if (!jarId) return 'invalid';
      if (rowsRef.current.some((r) => r.jarId === jarId && r.id !== id)) return 'duplicate';
      const autoSave = !friendsDiffer(rowsRef.current, savedRef.current);
      setBusy(id, true);
      try {
        const jar = await fetchPublicJar(jarId);
        setRows((rs) => rs.map((r) => (r.id === id ? { ...applyJarInfo({ ...r, jarId }, jar, Date.now()) } : r)));
        setRowError(id);
        finish(autoSave);
        return null;
      } catch (err) {
        return kindOf(err);
      } finally {
        if (alive.current) setBusy(id, false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const unlinkJar = useCallback(
    (id: string) => {
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, jarId: undefined, closed: undefined, syncedAt: undefined } : r)));
      setRowError(id);
    },
    [setRows],
  );

  /** Adds a new helper for each pasted id (skipping ids already linked), reading each jar. */
  const addByIds = useCallback(
    async (inputs: string[]): Promise<{ added: number; invalid: number; duplicate: number; failed: JarErrorKind | null }> => {
      const out = { added: 0, invalid: 0, duplicate: 0, failed: null as JarErrorKind | null };
      const autoSave = !friendsDiffer(rowsRef.current, savedRef.current);
      const ids: string[] = [];
      for (const raw of inputs) {
        const jarId = parseJarId(raw);
        if (!jarId) out.invalid++;
        else if (ids.includes(jarId) || rowsRef.current.some((r) => r.jarId === jarId)) out.duplicate++;
        else ids.push(jarId);
      }
      for (let i = 0; i < ids.length && alive.current; i++) {
        if (i > 0) await sleep(REFRESH_GAP_MS);
        try {
          const jar = await fetchPublicJar(ids[i]);
          const taken = new Set(rowsRef.current.map((r) => friendNameKey(r.name)));
          // the owner's name; two helpers with the same name are told apart by their jar's title, then by a number
          const owner = jar.ownerName || jar.title || '—';
          let name = owner;
          if (taken.has(friendNameKey(name)) && jar.title && jar.title !== owner) name = `${owner} · ${jar.title}`;
          for (let n = 2; taken.has(friendNameKey(name)); n++) name = `${owner} (${n})`;
          const fresh = applyJarInfo({ id: newFriend().id, name, raised: '', target: '', jarId: ids[i] }, jar, Date.now());
          setRows((rs) => [...rs, fresh]);
          out.added++;
        } catch (err) {
          out.failed = kindOf(err);
          if (out.failed === 'rate-limit') break;
        }
      }
      finish(autoSave);
      return out;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { rows, setRows, dirty, duplicates, save, discard, busyIds, progress, rowErrors, summary, refreshOne, refreshAll, linkJar, unlinkJar, addByIds };
}

export type FriendsDraft = ReturnType<typeof useFriendsDraft>;
