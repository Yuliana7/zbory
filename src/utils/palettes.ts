export interface Palette {
  id: string;
  name: string;
  isDark: boolean;
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  accentGradient: string;
  logoGradient: string;
  cardBg: string;
  cardBorder: string;
  progressTrack: string;
  chartLine: string;
  chartArea: string;
  glowColor: string;
}

export const PALETTES: Palette[] = [
  {
    id: 'dark-navy',
    name: 'Ніч',
    isDark: true,
    background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)',
    primary: '#ffffff',
    secondary: 'rgba(255,255,255,0.5)',
    accent: '#a5b4fc',
    accentGradient: 'linear-gradient(135deg, #ffffff 0%, #c7d2fe 100%)',
    logoGradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    cardBg: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,255,255,0.1)',
    progressTrack: 'rgba(255,255,255,0.1)',
    chartLine: '#6366f1',
    chartArea: 'rgba(99,102,241,0.35)',
    glowColor: 'rgba(99,102,241,0.15)',
  },
  {
    id: 'dark-midnight',
    name: 'Північ',
    isDark: true,
    background: 'linear-gradient(145deg, #020617 0%, #0c1a2e 60%, #020617 100%)',
    primary: '#ffffff',
    secondary: 'rgba(255,255,255,0.45)',
    accent: '#67e8f9',
    accentGradient: 'linear-gradient(135deg, #ffffff 0%, #a5f3fc 100%)',
    logoGradient: 'linear-gradient(135deg, #0891b2, #06b6d4)',
    cardBg: 'rgba(6,182,212,0.06)',
    cardBorder: 'rgba(103,232,249,0.15)',
    progressTrack: 'rgba(255,255,255,0.08)',
    chartLine: '#06b6d4',
    chartArea: 'rgba(6,182,212,0.3)',
    glowColor: 'rgba(6,182,212,0.12)',
  },
  {
    id: 'dark-forest',
    name: 'Травень',
    isDark: true,
    background: 'linear-gradient(145deg, #052e16 0%, #0a3320 60%, #052e16 100%)',
    primary: '#ffffff',
    secondary: 'rgba(255,255,255,0.5)',
    accent: '#6ee7b7',
    accentGradient: 'linear-gradient(135deg, #ffffff 0%, #a7f3d0 100%)',
    logoGradient: 'linear-gradient(135deg, #059669, #34d399)',
    cardBg: 'rgba(52,211,153,0.06)',
    cardBorder: 'rgba(110,231,183,0.15)',
    progressTrack: 'rgba(255,255,255,0.1)',
    chartLine: '#34d399',
    chartArea: 'rgba(52,211,153,0.3)',
    glowColor: 'rgba(52,211,153,0.12)',
  },
  {
    id: 'light-dawn',
    name: 'Світанок',
    isDark: false,
    background: 'linear-gradient(145deg, #fefce8 0%, #fef3c7 60%, #fffbeb 100%)',
    primary: '#1c1917',
    secondary: 'rgba(28,25,23,0.5)',
    accent: '#d97706',
    accentGradient: 'linear-gradient(135deg, #92400e 0%, #d97706 100%)',
    logoGradient: 'linear-gradient(135deg, #d97706, #f59e0b)',
    cardBg: 'rgba(217,119,6,0.07)',
    cardBorder: 'rgba(217,119,6,0.2)',
    progressTrack: 'rgba(28,25,23,0.1)',
    chartLine: '#d97706',
    chartArea: 'rgba(217,119,6,0.2)',
    glowColor: 'rgba(251,191,36,0.25)',
  },
  {
    id: 'light-sky',
    name: 'Небо',
    isDark: false,
    background: 'linear-gradient(145deg, #f0f9ff 0%, #dbeafe 60%, #eff6ff 100%)',
    primary: '#1e3a5f',
    secondary: 'rgba(30,58,95,0.55)',
    accent: '#2563eb',
    accentGradient: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
    logoGradient: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
    cardBg: 'rgba(37,99,235,0.07)',
    cardBorder: 'rgba(37,99,235,0.2)',
    progressTrack: 'rgba(30,58,95,0.1)',
    chartLine: '#3b82f6',
    chartArea: 'rgba(59,130,246,0.2)',
    glowColor: 'rgba(59,130,246,0.15)',
  },
  {
    id: 'light-rose',
    name: 'Червень',
    isDark: false,
    background: 'linear-gradient(145deg, #fff1f2 0%, #fce7f3 60%, #fdf2f8 100%)',
    primary: '#4a1942',
    secondary: 'rgba(74,25,66,0.5)',
    accent: '#e11d48',
    accentGradient: 'linear-gradient(135deg, #9d174d 0%, #e11d48 100%)',
    logoGradient: 'linear-gradient(135deg, #be185d, #f43f5e)',
    cardBg: 'rgba(225,29,72,0.06)',
    cardBorder: 'rgba(225,29,72,0.18)',
    progressTrack: 'rgba(74,25,66,0.1)',
    chartLine: '#f43f5e',
    chartArea: 'rgba(244,63,94,0.2)',
    glowColor: 'rgba(251,113,133,0.2)',
  },
];

export const DEFAULT_PALETTE = PALETTES[0];

export function getPalette(id: string): Palette {
  return PALETTES.find(p => p.id === id) ?? DEFAULT_PALETTE;
}
