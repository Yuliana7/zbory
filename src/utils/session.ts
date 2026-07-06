import type { RawDonation } from '../types';

const KEY = 'zbory-session-v1';

export interface SavedSession {
  rawData: RawDonation[];
  goal?: number;
  fileName: string | null;
  savedAt: number;
}

/** Persists the last uploaded dataset so an accidental refresh isn't fatal. */
export function saveSession(rawData: RawDonation[], fileName: string | null): void {
  try {
    const prev = loadSession();
    const session: SavedSession = { rawData, fileName, goal: prev?.goal, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Quota exceeded (huge CSV) or storage unavailable — autosave is best-effort
  }
}

export function updateSessionGoal(goal?: number): void {
  try {
    const session = loadSession();
    if (!session) return;
    localStorage.setItem(KEY, JSON.stringify({ ...session, goal }));
  } catch {
    // best-effort
  }
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as SavedSession;
    if (!Array.isArray(session.rawData) || session.rawData.length === 0) return null;
    return session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // best-effort
  }
}
