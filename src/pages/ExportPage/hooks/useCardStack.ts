import { useState, useRef, useMemo, useEffect, useCallback, type Dispatch } from 'react';
import type { AppState, CardState, SharedStyle, TemplateType } from '../../../types';
import type { AppAction } from '../../../context/AppContext';
import type { getPersonalComments } from '../../../utils/commentAnalyzer';
import type { ThemeRecord } from '../../../utils/themeStore';
import { DEFAULT_SHARED_STYLE, mergeCards } from '../../../utils/exportStack';

type PersonalComment = ReturnType<typeof getPersonalComments>[number];

/**
 * Owns the editing stack: which templates are in it, which card is current,
 * and how edits (per-card or shared-style) get dispatched back into
 * AppContext. Stack data itself lives in app.stackCards/app.stackStyle — this
 * hook has no local mirror copy, so there's nothing to fall out of sync on a
 * gallery ⇄ export round trip.
 */
export function useCardStack(
  stackIds: TemplateType[],
  app: AppState,
  dispatch: Dispatch<AppAction>,
  personalComments: PersonalComment[],
) {
  const cards = useMemo(
    () => mergeCards(stackIds, app.stackCards ?? [], personalComments),
    [stackIds, personalComments, app.stackCards],
  );
  const [current, setCurrent] = useState(0);
  const safeCurrent = Math.min(current, cards.length - 1);
  const card = cards[safeCurrent];
  const sharedStyle = app.stackStyle ?? DEFAULT_SHARED_STYLE;

  // Persist the reconciled card list into context on mount and whenever the
  // template selection changes while mounted (e.g. "+ додати шаблон"), guarded
  // by idsKey so per-keystroke edits (which also change app.stackCards) don't
  // re-trigger this.
  const idsKey = stackIds.join(',');
  const prevIdsKey = useRef<string | null>(null);
  useEffect(() => {
    if (prevIdsKey.current === idsKey) return;
    prevIdsKey.current = idsKey;
    dispatch({ type: 'STACK_UPDATED', payload: { cards, style: sharedStyle } });
  }, [idsKey, cards, sharedStyle, dispatch]);

  const updateCard = useCallback((patch: Partial<CardState>) => {
    const nextCards = cards.map((c, i) => (i === safeCurrent ? { ...c, ...patch, touched: true } : c));
    dispatch({ type: 'STACK_UPDATED', payload: { cards: nextCards, style: sharedStyle } });
  }, [cards, safeCurrent, sharedStyle, dispatch]);

  const style = card.styleOverride ?? sharedStyle;
  const styleUnlinked = card.styleOverride !== null;

  // A manual edit (palette click, a slider, a new bg upload — none of which
  // ever include themeId themselves) always un-marks the style as "exactly
  // this theme"; only applyTheme below passes themeId explicitly. baseThemeId
  // is left alone, so the theme it started from can still be updated.
  const patchStyle = (patch: Partial<SharedStyle>) => {
    const next = 'themeId' in patch ? patch : { ...patch, themeId: null };
    if (card.styleOverride) {
      updateCard({ styleOverride: { ...card.styleOverride, ...next } });
    } else {
      dispatch({ type: 'STACK_UPDATED', payload: { cards, style: { ...sharedStyle, ...next } } });
    }
  };

  const applyTheme = (theme: ThemeRecord) => patchStyle({ ...theme.style, themeId: theme.id, baseThemeId: theme.id });

  const goPrev = useCallback(() => setCurrent((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setCurrent((i) => Math.min(cards.length - 1, i + 1)), [cards.length]);

  // ←/→ navigate the deck (unless the user is typing)
  useEffect(() => {
    if (cards.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cards.length, goPrev, goNext]);

  const removeCurrentCard = () => {
    if (cards.length <= 1) return;
    const newIds = cards.map((c) => c.templateId).filter((_, i) => i !== safeCurrent);
    dispatch({ type: 'GALLERY_UI', payload: { selection: newIds } });
    dispatch({ type: 'TEMPLATES_SELECTED', payload: newIds });
    setCurrent(Math.max(0, safeCurrent - 1));
  };

  const addTemplate = (id: TemplateType) => {
    const newIds = [...cards.map((c) => c.templateId), id];
    dispatch({ type: 'GALLERY_UI', payload: { selection: newIds } });
    dispatch({ type: 'TEMPLATES_SELECTED', payload: newIds });
    setCurrent(newIds.length - 1);
  };

  return {
    cards,
    current,
    setCurrent,
    safeCurrent,
    card,
    sharedStyle,
    updateCard,
    style,
    styleUnlinked,
    patchStyle,
    applyTheme,
    goPrev,
    goNext,
    removeCurrentCard,
    addTemplate,
  };
}
