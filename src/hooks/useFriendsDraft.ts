import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useAppContext } from '../context/AppContext';
import {
  applyJarInfo,
  duplicateNameIds,
  friendNameKey,
  friendsDiffer,
  friendsToRows,
  newFriend,
  helperProblem,
  rowsToFriends,
  type FriendDraftRow,
} from '../utils/friendJars';
import { JarError, fetchPublicJar, lookupJar, parseJarRef, type JarErrorKind, type PublicJar } from '../utils/monobankJar';

/** Pause between two reads when ids are added one by one. */
const REFRESH_GAP_MS = 1000;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const kindOf = (err: unknown): JarErrorKind => (err instanceof JarError ? err.kind : 'unexpected');

export type LinkResult = JarErrorKind | 'invalid' | 'duplicate' | 'other-main' | 'not-helper' | 'unverified' | null;

export interface AddResult {
  added: number;
  invalid: number;
  duplicate: number;
  /** left out: they feed a different main jar */
  otherMain: number;
  /** left out: they feed no other jar, so they aren't helpers */
  notHelper: number;
  /** added without the check, because our lookup is unavailable */
  unverified: number;
  failed: JarErrorKind | null;
}

interface Resolved {
  jarId: string;
  jar: PublicJar;
  parentJar?: string;
  checked: boolean;
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
  const mainShortIdRef = useRef(state.app.monobankJar?.shortId);
  mainShortIdRef.current = state.app.monobankJar?.shortId;
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

  /** A blank row for typing a helper in by hand. */
  const addRow = useCallback(() => setRows((rs) => [...rs, { id: newFriend().id, name: '', raised: '', target: '' }]), [setRows]);

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

  /** Reads what was pasted, a share link or a long id, and finds which main jar it feeds. `checked` is
   * false only when our lookup is unavailable: a pasted long id must still work then. */
  const resolve = async (raw: string): Promise<Resolved | null> => {
    const ref = parseJarRef(raw);
    if (!ref) return null;
    if (ref.kind === 'short') {
      const found = await lookupJar(ref.id);
      const jar = await fetchPublicJar(found.longId);
      return { jarId: found.longId, jar: { ...jar, shortId: jar.shortId ?? ref.id }, parentJar: found.mainJar, checked: true };
    }
    const jar = await fetchPublicJar(ref.id);
    if (!jar.shortId) return { jarId: ref.id, jar, checked: false };
    try {
      return { jarId: ref.id, jar, parentJar: (await lookupJar(jar.shortId)).mainJar, checked: true };
    } catch (err) {
      if (err instanceof JarError && err.kind === 'lookup') return { jarId: ref.id, jar, checked: false };
      throw err;
    }
  };

  /** Links a row to a helper's jar by its share link or long id, if it is a helper of this project. */
  const linkJar = useCallback(
    async (id: string, input: string): Promise<LinkResult> => {
      const autoSave = !friendsDiffer(rowsRef.current, savedRef.current);
      setBusy(id, true);
      try {
        const target = await resolve(input);
        if (!target) return 'invalid';
        if (rowsRef.current.some((r) => r.jarId === target.jarId && r.id !== id)) return 'duplicate';
        if (target.checked) {
          const problem = helperProblem(target.parentJar, mainShortIdRef.current, rowsRef.current.filter((r) => r.id !== id));
          if (problem) return problem;
        }
        setRows((rs) => rs.map((r) => (r.id === id ? { ...applyJarInfo({ ...r, jarId: target.jarId }, target.jar, Date.now()), parentJar: target.parentJar } : r)));
        setRowError(id);
        finish(autoSave);
        return target.checked ? null : 'unverified';
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
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, jarId: undefined, shortId: undefined, closed: undefined, syncedAt: undefined } : r)));
      setRowError(id);
    },
    [setRows],
  );

  /** Adds a new helper for each pasted link or id, reading each jar. Only jars that feed this project's
   * main jar get in; anything else is counted and left out. */
  const addByIds = useCallback(
    async (inputs: string[]): Promise<AddResult> => {
      const out: AddResult = { added: 0, invalid: 0, duplicate: 0, otherMain: 0, notHelper: 0, unverified: 0, failed: null };
      const autoSave = !friendsDiffer(rowsRef.current, savedRef.current);
      for (let i = 0; i < inputs.length && alive.current; i++) {
        if (i > 0) await sleep(REFRESH_GAP_MS);
        try {
          const target = await resolve(inputs[i]);
          if (!target) {
            out.invalid++;
            continue;
          }
          if (rowsRef.current.some((r) => r.jarId === target.jarId)) {
            out.duplicate++;
            continue;
          }
          if (target.checked) {
            const problem = helperProblem(target.parentJar, mainShortIdRef.current, rowsRef.current);
            if (problem === 'not-helper') out.notHelper++;
            if (problem === 'other-main') out.otherMain++;
            if (problem) continue;
          } else {
            out.unverified++;
          }
          const { jar } = target;
          const taken = new Set(rowsRef.current.map((r) => friendNameKey(r.name)));
          // the owner's name; two helpers with the same name are told apart by their jar's title, then by a number
          const owner = jar.ownerName || jar.title || '—';
          let name = owner;
          if (taken.has(friendNameKey(name)) && jar.title && jar.title !== owner) name = `${owner} · ${jar.title}`;
          for (let n = 2; taken.has(friendNameKey(name)); n++) name = `${owner} (${n})`;
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

  return { rows, setRows, addRow, dirty, duplicates, save, discard, busyIds, rowErrors, refreshOne, linkJar, unlinkJar, addByIds };
}

export type FriendsDraft = ReturnType<typeof useFriendsDraft>;
