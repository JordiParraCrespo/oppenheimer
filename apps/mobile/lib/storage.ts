import type { IStorageService } from '@oppenheimer/frontend';
import * as SecureStore from 'expo-secure-store';

/** Secrets only. Preferences live in MMKV (`lib/storage/mmkv.ts`). */
const AUTH_KEYS = ['accessToken', 'refreshToken'] as const;

export class ExpoSecureStoreService implements IStorageService {
  async get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  }

  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  }

  async remove(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  }

  async clear(): Promise<void> {
    await Promise.all(AUTH_KEYS.map((key) => SecureStore.deleteItemAsync(key)));
  }
}
