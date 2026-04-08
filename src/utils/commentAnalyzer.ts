import type { Donation, CommentInsights, RepeatDonor } from '../types';

// Auto-generated Monobank comment — not a personal message
const AUTO_COMMENT = 'Поповнення рахунку банки';

/**
 * Analyzes donation comments to extract:
 * - Top emojis used across comments + donor names
 * - Repeat donor identities
 * - External community links / mentions
 */
export function analyzeComments(donations: Donation[]): CommentInsights {
  const personalComments = donations.filter(d => isPersonalComment(d.comment));
  const hasEnoughData =
    personalComments.length >= 5 &&
    personalComments.length / donations.length >= 0.03;

  if (!hasEnoughData) {
    return {
      totalWithComments: personalComments.length,
      topEmojis: [],
      repeatDonors: [],
      communities: [],
      hasEnoughData: false,
    };
  }

  return {
    totalWithComments: personalComments.length,
    topEmojis: extractTopEmojis(donations),
    repeatDonors: findRepeatDonors(donations),
    communities: detectCommunities(donations),
    hasEnoughData: true,
  };
}

// ─── Personal comment filter ──────────────────────────────────────────────────

function isPersonalComment(comment: string | undefined): comment is string {
  if (!comment || !comment.trim()) return false;
  const normalized = comment.trim();
  if (normalized === AUTO_COMMENT) return false;
  if (normalized.length < 2) return false;
  return true;
}

// ─── Emoji analysis ───────────────────────────────────────────────────────────

/**
 * Returns true if a grapheme cluster is an emoji.
 * Uses char code ranges instead of regex for reliability:
 *   U+1F300–U+1FFFF  — most modern emojis (faces, objects, symbols)
 *   U+2600–U+27BF    — misc symbols & dingbats (☀️ ✈️ etc.)
 *   U+1F1E0–U+1F1FF  — regional indicator letters (flag pairs)
 */
function isEmojiGrapheme(grapheme: string): boolean {
  const cp = grapheme.codePointAt(0);
  if (cp === undefined) return false;

  return (
    (cp >= 0x1f300 && cp <= 0x1ffff) || // main emoji block
    (cp >= 0x2600 && cp <= 0x27bf) ||   // misc symbols & dingbats
    (cp >= 0x1f1e0 && cp <= 0x1f1ff)    // regional indicators (flags)
  );
}

function extractTopEmojis(donations: Donation[]): Array<{ emoji: string; count: number }> {
  const counts = new Map<string, number>();
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

  for (const d of donations) {
    // Only scan comments — donor field emojis (e.g. 🐈) are Monobank's
    // anonymous sender marker, not messages from donors.
    if (!d.comment) continue;
    for (const { segment } of segmenter.segment(d.comment)) {
      if (isEmojiGrapheme(segment)) {
        counts.set(segment, (counts.get(segment) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([emoji, count]) => ({ emoji, count }));
}

// ─── Repeat donors ────────────────────────────────────────────────────────────

function findRepeatDonors(donations: Donation[]): RepeatDonor[] {
  const byIdentity = new Map<string, { display: string; count: number; total: number }>();

  for (const d of donations) {
    const identity = resolveIdentity(d);
    if (!identity) continue;

    const key = normalizeIdentity(identity);
    const existing = byIdentity.get(key);
    if (existing) {
      existing.count += 1;
      existing.total += d.amount;
    } else {
      byIdentity.set(key, { display: identity, count: 1, total: d.amount });
    }
  }

  return [...byIdentity.values()]
    .filter(v => v.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(({ display, count, total }) => ({
      identity: display,
      count,
      totalAmount: total,
    }));
}

/**
 * Picks the best identity for a donation:
 * - donor name (if it's a real name, not auto-text)
 * - short personal comment (emoji-like, first-name signatures, etc.)
 */
function resolveIdentity(d: Donation): string | null {
  if (d.donor && d.donor !== 'Власний внесок') return d.donor;

  if (d.comment && isPersonalComment(d.comment)) {
    const c = d.comment.trim();
    // Only use comment as identity if it's short enough to be a name/signature
    if (c.length <= 40 && !c.includes('http') && !c.includes('t.me')) {
      return c;
    }
  }

  return null;
}

function normalizeIdentity(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ─── External communities ─────────────────────────────────────────────────────

interface CommunityPattern {
  regex: RegExp;
  label: (m: RegExpExecArray) => string;
}

const COMMUNITY_PATTERNS: CommunityPattern[] = [
  {
    // Telegram: t.me/channel (with or without https://)
    regex: /(?:https?:\/\/)?t\.me\/([\w_]+)/gi,
    label: m => `t.me/${m[1]}`,
  },
  {
    // @mentions (Telegram / social media style)
    regex: /@([\w_]{3,})/g,
    label: m => `@${m[1]}`,
  },
  {
    // Generic URLs (catch-all after t.me)
    regex: /https?:\/\/[^\s]+/gi,
    label: m => shortenUrl(m[0]),
  },
  {
    // Ukrainian: "від команди X" / "з групи X" / "від спільноти X"
    regex: /(?:від команди|з групи|від спільноти)\s+([\wа-яіїєґА-ЯІЇЄҐ\s"'«»-]{2,30})/gi,
    label: m => m[1].trim(),
  },
];

function detectCommunities(donations: Donation[]): string[] {
  const found = new Set<string>();

  for (const d of donations) {
    // Community links only appear in comments, not in sender names
    const texts = [d.comment].filter(Boolean) as string[];
    for (const text of texts) {
      for (const { regex, label } of COMMUNITY_PATTERNS) {
        regex.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(text)) !== null) {
          found.add(label(m));
        }
      }
    }
  }

  return [...found].slice(0, 10);
}

function shortenUrl(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    const path = pathname.length > 20 ? pathname.slice(0, 20) + '…' : pathname;
    return hostname + (path === '/' ? '' : path);
  } catch {
    return url.slice(0, 40);
  }
}
