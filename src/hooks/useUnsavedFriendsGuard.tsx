import { useState, type ReactNode } from 'react';
import { UnsavedFriendsDialog } from '../components/upload/UnsavedFriendsDialog';
import type { FriendsDraft } from './useFriendsDraft';

/** Wraps leaving the friends editor: it saves whatever is waiting and goes. Only when that can't be
 * saved (two helpers share a name) does it ask first: fix it, or leave without those changes.
 * Render `dialog` somewhere on the screen. */
export function useUnsavedFriendsGuard(draft: FriendsDraft): { guard: (leave: () => void) => void; dialog: ReactNode } {
  const [pending, setPending] = useState<(() => void) | null>(null);

  const guard = (leave: () => void) => {
    if (draft.save()) leave();
    else setPending(() => leave);
  };

  const dialog = pending ? (
    <UnsavedFriendsDialog
      onDiscard={() => {
        const leave = pending;
        setPending(null);
        draft.discard();
        leave();
      }}
      onCancel={() => setPending(null)}
    />
  ) : null;

  return { guard, dialog };
}
