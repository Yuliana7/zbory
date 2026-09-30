import { useState, useCallback } from 'react';
import type { Aggregates, CardState, Donation } from '../../../types';
import type { SelectedComment } from '../../../components/templates/CommentsCard';
import { filterAggregates } from '../../../utils/exportStack';
import { generateCaption } from '../../../utils/captionGenerator';

type TFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Per-card captions: live-generated from the data until the user edits one
 * ("regenerate" just drops the edited copy), plus clipboard copy state for
 * the current card and for the whole stack bundled together.
 */
export function useCaptionClipboard(
  donations: Donation[],
  fullAggregates: Aggregates,
  t: TFn,
  goalValue: number | undefined,
  commentsFor: (c: CardState) => SelectedComment[],
) {
  const [captionCopied, setCaptionCopied] = useState(false);
  const [allCaptionsCopied, setAllCaptionsCopied] = useState(false);

  const captionFor = useCallback(
    (c: CardState): string =>
      c.captionText ??
      generateCaption(c.templateId, filterAggregates(donations, fullAggregates, c.dateFrom, c.dateTo), t, {
        goal: goalValue,
        linkUrl: c.textOverrides.linkUrl,
        comments: commentsFor(c),
      }),
    [donations, fullAggregates, t, goalValue, commentsFor],
  );

  const copyCaption = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
  };

  const copyAllCaptions = async (cards: CardState[]) => {
    const bundle = cards
      .map((c, i) => `${i + 1}/${cards.length}\n${captionFor(c)}`)
      .join('\n\n———\n\n');
    try {
      await navigator.clipboard.writeText(bundle);
      setAllCaptionsCopied(true);
      setTimeout(() => setAllCaptionsCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
  };

  return { captionFor, captionCopied, allCaptionsCopied, copyCaption, copyAllCaptions };
}
