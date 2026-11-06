// The Monobank token, remembered on this device only when the user asks for it. Off by default: without
// that choice it stays in memory for one read and is gone. It gives read access to statements and is
// only ever sent to api.monobank.ua.

const KEY = 'zbory.monobankToken';

export function loadToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  try {
    localStorage.setItem(KEY, token.trim());
  } catch {
    /* private mode: the app just asks again next time */
  }
}

export function forgetToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing was stored */
  }
}
