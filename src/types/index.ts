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

// Aggregated statistics
export interface Aggregates {
  totalAmount: number;
  donationCount: number;
  avgDonation: number;
  minDonation: number;
  maxDonation: number;

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
}

// Insight type for display
export interface Insight {
  icon: string;
  title: string;
  value: string;
  description?: string;
  type?: 'insight' | 'action'; // 'action' = "Що робити далі?" recommendations
}

// Template types
export type TemplateType =
  | 'progress'
  | 'daily-activity'
  | 'thank-you'
  | 'milestone'
  | 'top-donors'
  | 'donors-count'
  | 'urgency'
  | 'weekly-recap'
  | 'speed';

export interface Template {
  id: TemplateType;
  name: string;
  description: string;
  format: 'post' | 'story'; // post: 1080x1080, story: 1080x1920
  requiresGoal?: boolean;
}

// App state
export interface AppState {
  step: 'upload' | 'insights' | 'gallery' | 'export';
  rawData: RawDonation[] | null;
  donations: Donation[] | null;
  aggregates: Aggregates | null;
  insights: Insight[] | null;
  commentInsights: CommentInsights | null;
  selectedTemplate: Template | null;
  goal?: number;
}

// Comment analysis results
export interface RepeatDonor {
  identity: string;      // donor name, emoji, or comment snippet
  count: number;         // number of donations
  totalAmount: number;
}

export interface CommentInsights {
  totalWithComments: number;                      // donations with a personal comment (not auto-text)
  topEmojis: Array<{ emoji: string; count: number }>;
  repeatDonors: RepeatDonor[];                    // identities with 2+ donations
  communities: string[];                          // detected group links / mentions
  hasEnoughData: boolean;                         // false when <3% of donations have comments
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