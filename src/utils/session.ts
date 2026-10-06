import type { FriendJar, MonobankJarRef, RawDonation } from '../types';
import { withTimestamps } from './timestamps';

const KEY = 'zbory-session-v1';

export interface SavedSession {
  rawData: RawDonation[];
  goal?: number;
  friends?: FriendJar[];
  monobankJar?: MonobankJarRef;
  fileName: string | null;
  savedAt: number;
}

/** Persists the last uploaded dataset so an accidental refresh isn't fatal. */
export function saveSession(rawData: RawDonation[], fileName: string | null): void {
  try {
    const prev = loadSession();
    const session: SavedSession = { rawData: withTimestamps(rawData), fileName, goal: prev?.goal, friends: prev?.friends, monobankJar: prev?.monobankJar, savedAt: Date.now() };
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

export function updateSessionFriends(friends: FriendJar[]): void {
  try {
    const session = loadSession();
    if (!session) return;
    localStorage.setItem(KEY, JSON.stringify({ ...session, friends }));
  } catch {
    // best-effort
  }
}

export function updateSessionMonobankJar(monobankJar?: MonobankJarRef): void {
  try {
    const session = loadSession();
    if (!session) return;
    localStorage.setItem(KEY, JSON.stringify({ ...session, monobankJar }));
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
