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
  usualParentJar,
  type FriendDraftRow,
} from '../utils/friendJars';
import { JarError, fetchPublicJar, lookupJar, parseJarRef, type JarErrorKind } from '../utils/monobankJar';

/** Pause between two reads when ids are added one by one. */
const REFRESH_GAP_MS = 1000;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const kindOf = (err: unknown): JarErrorKind => (err instanceof JarError ? err.kind : 'unexpected');

export type LinkResult = JarErrorKind | 'invalid' | 'duplicate' | 'other-main' | 'not-helper' | null;

export interface AddResult {
  added: number;
  invalid: number;
  duplicate: number;
  /** added, but they feed a different main jar than the other helpers */
  otherMain: number;
  /** left out: Monobank says they don't feed another jar, so they aren't helpers */
  notHelper: number;
  failed: JarErrorKind | null;
}

/** What is typed into the helper-jar editor, kept apart from what is saved: nothing reaches the
 * app (and the cards) until `save()`, and `dirty` says whether leaving would lose something.
 *
 * Reading a linked jar from Monobank (`refreshOne`, `linkJar`, `addByIds`) goes through
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
  const [rowErrors, setRowErrors] = useState<Record<string, JarErrorKind>>({});
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

  /** A pasted link or id → the long id to read (and the main jar, when a share link was looked up). */
  const resolve = async (raw: string): Promise<{ jarId: string; parentJar?: string; viaLink: boolean } | null> => {
    const ref = parseJarRef(raw);
    if (!ref) return null;
    if (ref.kind === 'long') return { jarId: ref.id, viaLink: false };
    const found = await lookupJar(ref.id);
    return { jarId: found.longId, parentJar: found.mainJar, viaLink: true };
  };

  /** Links a row to a helper's jar by its share link or long id and reads it. Resolves to an error kind, or null on success. */
  const linkJar = useCallback(
    async (id: string, input: string): Promise<LinkResult> => {
      const autoSave = !friendsDiffer(rowsRef.current, savedRef.current);
      setBusy(id, true);
      try {
        const target = await resolve(input);
        if (!target) return 'invalid';
        if (target.viaLink && !target.parentJar) return 'not-helper';
        if (rowsRef.current.some((r) => r.jarId === target.jarId && r.id !== id)) return 'duplicate';
        const jar = await fetchPublicJar(target.jarId);
        const expected = usualParentJar(rowsRef.current.filter((r) => r.id !== id));
        setRows((rs) => rs.map((r) => (r.id === id ? { ...applyJarInfo({ ...r, jarId: target.jarId }, jar, Date.now()), parentJar: target.parentJar } : r)));
        setRowError(id);
        finish(autoSave);
        return target.parentJar && expected && target.parentJar !== expected ? 'other-main' : null;
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

  /** Adds a new helper for each pasted link or id (skipping jars already there), reading each jar. A jar that
   * feeds no other jar is left out; one feeding a different jar is added with a warning, since the
   * comparison is only with the other helpers. */
  const addByIds = useCallback(
    async (inputs: string[]): Promise<AddResult> => {
      const out: AddResult = { added: 0, invalid: 0, duplicate: 0, otherMain: 0, notHelper: 0, failed: null };
      const autoSave = !friendsDiffer(rowsRef.current, savedRef.current);
      for (let i = 0; i < inputs.length && alive.current; i++) {
        if (i > 0) await sleep(REFRESH_GAP_MS);
        try {
          const target = await resolve(inputs[i]);
          if (!target) {
            out.invalid++;
            continue;
          }
          // the main jar's link, usually: its whole total would count as one helper's share
          if (target.viaLink && !target.parentJar) {
            out.notHelper++;
            continue;
          }
          if (rowsRef.current.some((r) => r.jarId === target.jarId)) {
            out.duplicate++;
            continue;
          }
          const jar = await fetchPublicJar(target.jarId);
          const taken = new Set(rowsRef.current.map((r) => friendNameKey(r.name)));
          // the owner's name; two helpers with the same name are told apart by their jar's title, then by a number
          const owner = jar.ownerName || jar.title || '—';
          let name = owner;
          if (taken.has(friendNameKey(name)) && jar.title && jar.title !== owner) name = `${owner} · ${jar.title}`;
          for (let n = 2; taken.has(friendNameKey(name)); n++) name = `${owner} (${n})`;
          const expected = usualParentJar(rowsRef.current);
          if (target.parentJar && expected && target.parentJar !== expected) out.otherMain++;
          const fresh = applyJarInfo({ id: newFriend().id, name, raised: '', target: '', jarId: target.jarId, parentJar: target.parentJar }, jar, Date.now());
          setRows((rs) => [...rs, fresh]);
          out.added++;
        } catch (err) {
          out.failed = kindOf(err);
          if (out.failed === 'rate-limit' || out.failed === 'lookup') break;
        }
      }
      finish(autoSave);
      return out;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { rows, setRows, dirty, duplicates, save, discard, busyIds, rowErrors, refreshOne, linkJar, unlinkJar, addByIds };
}

export type FriendsDraft = ReturnType<typeof useFriendsDraft>;
