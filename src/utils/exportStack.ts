import type { TemplateType, CardState, SharedStyle, Donation, Aggregates } from '../types';
import { DEFAULT_PALETTE } from './palettes';
import { TEMPLATE_DEFAULT_FORMAT } from './templateConfig';
import { aggregateDonations } from './dataAggregator';
import { orderedRange } from './dateRange';

export type Format = 'post' | 'post-4-5' | 'story';

export const FORMAT_DIMS: Record<Format, { width: number; height: number; label: string }> = {
  post: { width: 1080, height: 1080, label: '1080×1080' },
  'post-4-5': { width: 1080, height: 1350, label: '1080×1350' },
  story: { width: 1080, height: 1920, label: '1080×1920' },
};

export const DEFAULT_SHARED_STYLE: SharedStyle = {
  palette: DEFAULT_PALETTE,
  bgImage: null,
  bgColor: null,
  bgTransparent: false,
  bgBrightness: 1,
  bgOpacity: 1,
  bgZoom: 1,
  bgOffsetX: 0,
  bgOffsetY: 0,
  bgRotate: 0,
  fontScale: 1,
  themeId: null,
  baseThemeId: null,
};

/** A date as an <input type="date"> value, on the user's clock: a UTC date is the day before for the first hours of a Kyiv morning. */
export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function makeCard(templateId: TemplateType, personalComments: Array<{ text: string }>): CardState {
  return {
    templateId,
    format: TEMPLATE_DEFAULT_FORMAT[templateId],
    textOverrides: {},
    hiddenElements: [],
    hiddenFriendIds: [],
    showRefunds: false,
    dateFrom: '',
    dateTo: '',
    selectedCommentKeys:
      templateId === 'comments' ? personalComments.slice(0, 3).map((c) => c.text) : [],
    styleOverride: null,
    touched: false,
  };
}

/**
 * Builds the card list for a template id sequence, reusing previously edited
 * cards (matched by template, consumed in order) so adding/removing/reordering
 * templates never discards edits.
 */
export function mergeCards(
  ids: TemplateType[],
  existing: CardState[],
  personalComments: Array<{ text: string }>,
): CardState[] {
  const pool = [...existing];
  return ids.map((id) => {
    const idx = pool.findIndex((c) => c.templateId === id);
    if (idx >= 0) return pool.splice(idx, 1)[0];
    return makeCard(id, personalComments);
  });
}

/** The donations on the days from–to (YYYY-MM-DD, either end may be open), on the user's clock. */
export function donationsInRange(donations: Donation[], dateFrom: string, dateTo: string): Donation[] {
  [dateFrom, dateTo] = orderedRange(dateFrom, dateTo);
  const from = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : 0;
  const to = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Infinity;
  return donations.filter((d) => {
    const ts = d.timestamp.getTime();
    return ts >= from && ts <= to;
  });
}

/** The card's numbers for a date range. A range with no donations falls back to the whole
 * campaign (the date panel says so), since the cards can't show an empty campaign. */
export function filterAggregates(
  donations: Donation[],
  fullAggregates: Aggregates,
  dateFrom: string,
  dateTo: string,
): Aggregates {
  if (!dateFrom && !dateTo) return fullAggregates;
  const filtered = donationsInRange(donations, dateFrom, dateTo);
  if (filtered.length === 0) return fullAggregates;
  try {
    return aggregateDonations(filtered);
  } catch {
    return fullAggregates;
  }
}
