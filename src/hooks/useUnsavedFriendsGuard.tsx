import { useState, type ReactNode } from 'react';
import { UnsavedFriendsDialog } from '../components/upload/UnsavedFriendsDialog';
import type { FriendsDraft } from './useFriendsDraft';

/** Wraps leaving a screen: with unsaved helper-jar edits it asks first (save / drop / stay),
 * otherwise it just goes. Render `dialog` somewhere on the screen. */
export function useUnsavedFriendsGuard(
  draft: FriendsDraft,
  /** saving was refused (two helpers share a name) — the screen should show the form */
  onSaveRefused?: () => void,
): { guard: (leave: () => void) => void; dialog: ReactNode } {
  const [pending, setPending] = useState<(() => void) | null>(null);

  const guard = (leave: () => void) => {
    if (draft.dirty) setPending(() => leave);
    else leave();
  };

  const resolve = (how: 'save' | 'discard') => {
    const leave = pending;
    setPending(null);
    if (how === 'save') {
      if (!draft.save()) {
        onSaveRefused?.();
        return;
      }
    } else draft.discard();
    leave?.();
  };

  const dialog = pending ? (
    <UnsavedFriendsDialog onSave={() => resolve('save')} onDiscard={() => resolve('discard')} onCancel={() => setPending(null)} />
  ) : null;

  return { guard, dialog };
}
