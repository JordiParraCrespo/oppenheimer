import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

const preferences = createMMKV({ id: 'oppenheimer.preferences' });
const queryCache = createMMKV({ id: 'oppenheimer.query-cache' });
const zustand = createMMKV({ id: 'oppenheimer.zustand' });

/**
 * JSON in, JSON out. A read is `unknown`: what is on the device was written by
 * an earlier build, so the caller checks its shape before trusting it.
 */
export type JsonStorage = {
  setItem(key: string, value: unknown): void;
  getItem(key: string): unknown;
  removeItem(key: string): void;
};

function jsonStorage(store: ReturnType<typeof createMMKV>): JsonStorage {
  return {
    setItem(key, value) {
      store.set(key, JSON.stringify(value));
    },
    getItem(key) {
      const value = store.getString(key);
      if (value === undefined) return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    },
    removeItem(key) {
      store.remove(key);
    },
  };
}

/** Preferences and config cache. JSON-encoded. Not secrets. */
export const storage = jsonStorage(preferences);

/** Raw string storage for TanStack Query persist (it serialises itself). */
export const queryStorage: StateStorage = {
  setItem(key, value) {
    queryCache.set(key, value);
  },
  getItem(key) {
    return queryCache.getString(key) ?? null;
  },
  removeItem(key) {
    queryCache.remove(key);
  },
};

/** Raw string storage for zustand persist. Own MMKV instance. */
export const stateStorage: StateStorage = {
  setItem(key, value) {
    zustand.set(key, value);
  },
  getItem(key) {
    return zustand.getString(key) ?? null;
  },
  removeItem(key) {
    zustand.remove(key);
  },
};
