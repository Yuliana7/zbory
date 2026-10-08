import { useCallback, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { duplicateNameIds, friendsDiffer, friendsToRows, rowsToFriends, type FriendDraftRow } from '../utils/friendJars';

/** What is typed into the helper-jar editor, kept apart from what is saved: nothing reaches the
 * app (and the cards) until `save()`, and `dirty` says whether leaving would lose something. */
export function useFriendsDraft() {
  const { state, handleFriendsChange } = useAppContext();
  const saved = state.app.friends;
  const [rows, setRows] = useState<FriendDraftRow[]>(() => friendsToRows(saved));
  const dirty = friendsDiffer(rows, saved);

  const duplicates = duplicateNameIds(rows);

  /** false (and nothing stored) while two helpers share a name */
  const save = useCallback((): boolean => {
    if (duplicateNameIds(rows).size > 0) return false;
    const clean = rowsToFriends(rows);
    handleFriendsChange(clean);
    setRows(friendsToRows(clean)); // drop blank rows from the form too
    return true;
  }, [rows, handleFriendsChange]);

  const discard = useCallback(() => setRows(friendsToRows(saved)), [saved]);

  return { rows, setRows, dirty, duplicates, save, discard };
}

export type FriendsDraft = ReturnType<typeof useFriendsDraft>;
