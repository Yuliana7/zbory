import { useCallback, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { friendsDiffer, friendsToRows, rowsToFriends, type FriendDraftRow } from '../utils/friendJars';

/** What is typed into the helper-jar editor, kept apart from what is saved: nothing reaches the
 * app (and the cards) until `save()`, and `dirty` says whether leaving would lose something. */
export function useFriendsDraft() {
  const { state, handleFriendsChange } = useAppContext();
  const saved = state.app.friends;
  const [rows, setRows] = useState<FriendDraftRow[]>(() => friendsToRows(saved));
  const dirty = friendsDiffer(rows, saved);

  const save = useCallback(() => {
    const clean = rowsToFriends(rows);
    handleFriendsChange(clean);
    setRows(friendsToRows(clean)); // drop blank rows from the form too
  }, [rows, handleFriendsChange]);

  const discard = useCallback(() => setRows(friendsToRows(saved)), [saved]);

  return { rows, setRows, dirty, save, discard };
}

export type FriendsDraft = ReturnType<typeof useFriendsDraft>;
