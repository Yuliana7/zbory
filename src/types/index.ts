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
}

// Insight type for display
export interface Insight {
  icon: string;
  title: string;
  value: string;
  description?: string;
}

// Template types
export type TemplateType = 'progress' | 'daily-activity' | 'thank-you';

export interface Template {
  id: TemplateType;
  name: string;
  description: string;
  format: 'post' | 'story'; // post: 1080x1080, story: 1080x1920
  requiresGoal?: boolean;
}

// App state
export interface AppState {
  step: 'upload' | 'insights' | 'export';
  rawData: RawDonation[] | null;
  donations: Donation[] | null;
  aggregates: Aggregates | null;
  insights: Insight[] | null;
  selectedTemplate: Template | null;
  goal?: number;
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