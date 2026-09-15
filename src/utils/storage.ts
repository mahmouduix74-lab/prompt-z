/**
 * Safe browser storage wrapper.
 * All localStorage access is wrapped in try/catch to ensure the app continues to run
 * if storage is blocked (e.g. strict private mode or browser restrictions).
 * In-memory fallback is used when localStorage is unavailable.
 */

const memoryStore = new Map<string, string>();

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Storage blocked or inaccessible
    }
    return memoryStore.get(key) || null;
  },

  setItem: (key: string, value: string): boolean => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return true;
      }
    } catch {
      // Storage blocked or quota exceeded
    }
    memoryStore.set(key, value);
    return false;
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Storage blocked
    }
    memoryStore.delete(key);
  },

  getJSON: <T>(key: string, defaultValue: T): T => {
    const raw = safeStorage.getItem(key);
    if (!raw) return defaultValue;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  },

  setJSON: <T>(key: string, value: T): boolean => {
    try {
      return safeStorage.setItem(key, JSON.stringify(value));
    } catch {
      return false;
    }
  },
};
