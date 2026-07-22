// Core data types based on the CSV structure from Monobank Jar
export interface RawDonation {
  date: string; // "Дата та час операції"
  category: string; // "Категорія операції"
  amount: string; // "Сума"
  currency: string; // "Валюта"
  additionalInfo: string; // "Додаткова інформація" (often contains donor name)
  comment: string; // "Коментар до платежу"
  balance: string; // "Залишок"
  balanceCurrency: string; // "Валюта залишку"
}

// Normalized donation data
export interface Donation {
  timestamp: Date;
  amount: number;
  donor?: string;
  category: string;
  comment?: string;
}

// A partial withdrawal from the jar (Часткове зняття)
export interface Withdrawal {
  timestamp: Date;
  amount: number;
  destination?: string; // "На білу картку" etc.
  balanceAfter: number; // Залишок after this withdrawal
}

// Aggregated statistics
export interface Aggregates {
  totalAmount: number; // gross donations (alias for totalRaised)
  totalRaised: number; // gross sum of all inbound donations
  donationCount: number;
  avgDonation: number;
  medianDonation: number;
  modeDonation: number; // most frequent exact amount
  p25Donation: number; // 25th percentile of donation amounts
  p75Donation: number; // 75th percentile of donation amounts
  minDonation: number;
  maxDonation: number;

  // Withdrawal / balance tracking (Option C)
  withdrawals: Withdrawal[];
  totalWithdrawn: number;
  currentBalance: number; // last Залишок from the raw CSV
  impliedRefunds: number; // max(0, totalRaised - totalWithdrawn - currentBalance)

  // Time-based aggregates
  byDay: Map<string, number>; // key: "YYYY-MM-DD", value: total amount
  byHour: Map<number, number>; // key: hour (0-23), value: count of donations
  byDate: Map<string, { amount: number; count: number }>; // key: "YYYY-MM-DD"

  // Cumulative data for charts
  cumulative: Array<{ date: string; total: number }>;

  // Date range
  firstDate: Date;
  lastDate: Date;

  // Distribution
  smallDonations: number; // < 100 UAH
  mediumDonations: number; // 100-1000 UAH
  largeDonations: number; // > 1000 UAH

  // Top donors by total amount
  topDonors: Array<{ name: string; amount: number; count: number }>;
  // Top donors by number of donations (frequent small donors matter too)
  topDonorsByCount: Array<{ name: string; amount: number; count: number }>;
  // Distinct named donors (deduped case-insensitively; anonymous markers excluded)
  uniqueDonors: number;
  // Donations without a usable donor name (empty or emoji-only, e.g. 🐈)
  anonymousDonations: number;
}

// ─── Stack editor state (shared with AppContext for in-session persistence) ──

import type { Palette } from '../utils/palettes';

// Visual style shared across a template series (a card may unlink and keep its own copy)
export interface SharedStyle {
  palette: Palette;
  bgImage: string | null;
  bgColor: string | null;
  bgTransparent: boolean;
  bgBrightness: number;
  bgOpacity: number;
  bgZoom: number;
  bgOffsetX: number;
  bgOffsetY: number;
  bgRotate: number;
  fontScale: number;
}

// Everything content-related that one card in the editing stack owns
export interface CardState {
  templateId: TemplateType;
  format: 'post' | 'post-4-5' | 'story';
  textOverrides: Record<string, string>;
  showHeader: boolean;
  showFooter: boolean;
  showUAFlag: boolean;
  showChart: boolean;
  showBars: boolean;
  showBestDay: boolean;
  showRefunds: boolean;
  dateFrom: string;
  dateTo: string;
  selectedCommentKeys: string[];
  /** null = live auto-generated caption; string = user-edited */
  captionText: string | null;
  /** non-null = this card detached from the series style and keeps its own */
  styleOverride: SharedStyle | null;
  touched: boolean;
}

// Insight type for display
export interface Insight {
  icon: string;
  title: string;
  value?: string;
  description?: string;
  // Optional breakdown lines rendered inside the card (e.g. mode/median/mean)
  stats?: Array<{ icon: string; label: string; value: string }>;
  type?: 'insight' | 'action'; // 'action' = "Що робити далі?" recommendations
}

// Template types
export type TemplateType =
  | 'progress'
  | 'daily-activity'
  | 'thank-you'
  | 'milestone'
  | 'top-donors'
  | 'top-donors-count'
  | 'donors-count'
  | 'urgency'
  | 'weekly-recap'
  | 'speed'
  | 'funds-flow'
  | 'final-report'
  | 'concrete-ask'
  | 'emoji-cloud'
  | 'comments'
  | 'report'
  | 'campaigns-chart';

export interface Template {
  id: TemplateType;
  name: string;
  description: string;
  format: 'post' | 'post-4-5' | 'story'; // post: 1080x1080, post-4-5: 1080x1350, story: 1080x1920
  requiresGoal?: boolean;
}

// App state
export interface AppState {
  step: 'upload' | 'insights' | 'gallery' | 'export';
  rawData: RawDonation[] | null;
  donations: Donation[] | null;
  withdrawals: Withdrawal[] | null;
  currentBalance: number;
  aggregates: Aggregates | null;
  insights: Insight[] | null;
  commentInsights: CommentInsights | null;
  // The editing stack: one or more templates selected in the gallery
  selectedTemplates: TemplateType[] | null;
  // Gallery UI state — persisted so navigating to export and back keeps it
  gallerySelection: TemplateType[];
  galleryOpenGroups: string[];
  // Stack editor state — survives the gallery ⇄ export round trip
  stackCards: CardState[] | null;
  stackStyle: SharedStyle | null;
  goal?: number;
  originalFileName: string | null;
  // Set when the current dataset came from / was saved to the campaign library
  activeCampaignId: string | null;
  // The saved campaign's display name (e.g. "FVP fundraiser") — null when
  // unsaved or when multiple campaigns are merged (no single name applies)
  activeCampaignName: string | null;
  // ≥2 = "multi mode": per-jar analytics view, cross-campaign sections and
  // report templates. The merged rows still live in rawData/donations.
  campaignDatasets: CampaignDataset[] | null;
}

// One statement inside a multi-campaign working set
export interface CampaignDataset {
  id: string;
  name: string;
  rawData: RawDonation[];
}

// Comment analysis results
export interface RepeatDonor {
  identity: string;      // donor name, emoji, or comment snippet
  count: number;         // number of donations
  totalAmount: number;
  // Multi-jar "Разом" view only: how many campaign statements this identity
  // appears in. Absent in single-jar contexts.
  campaignCount?: number;
}

export interface CommentInsights {
  totalWithComments: number;                      // donations with a personal comment (not auto-text)
  topEmojis: Array<{ emoji: string; count: number }>;
  repeatDonors: RepeatDonor[];                    // identities with 2+ donations, ranked by count
  topDonorsBySum: RepeatDonor[];                  // all identities, ranked by total amount
  communities: string[];                          // detected group links / mentions
  hasEnoughData: boolean;                         // false when <3% of donations have comments
}

// A single row in the manual statement editor
export interface ManualRow {
  id: string;        // React key (generateId)
  date: string;      // YYYY-MM-DD (from <input type="date">)
  time: string;      // HH:mm  (from <input type="time">, optional)
  name: string;      // donor name — required
  amount: string;    // positive number string — required
  category?: string; // defaults to "За посиланням"
  comment: string;   // optional
  balance: string;   // Залишок — shown auto-computed; user may override; empty = use computed
}

// Export options
export interface ExportOptions {
  template: Template;
  aggregates: Aggregates;
  insights: Insight[];
  goal?: number;
  format: 'png';
  dimensions: { width: number; height: number };
}