import type { CacheService } from '@oppenheimer/backend-cache';
import { describe, expect, it } from 'vitest';
import { CacheParkedImageAdapter } from '../infrastructure/cache-parked-image.adapter';

/** A cache with `take` as one read-and-delete, which is all the adapter relies on. */
function memoryCache(): CacheService {
  const store = new Map<string, unknown>();
  return {
    get: async (key: string) => store.get(key),
    set: async (key: string, value: unknown) => void store.set(key, value),
    take: async (key: string) => {
      const value = store.get(key);
      store.delete(key);
      return value;
    },
    del: async (key: string) => void store.delete(key),
    setIfAbsent: async () => true,
    reset: async () => store.clear(),
  } as unknown as CacheService;
}

const image = {
  hostId: 'host-a',
  sessionId: 'session-1',
  mediaType: 'image/png' as const,
  data: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
};

describe('CacheParkedImageAdapter', () => {
  it('hands an image over once, to the host it was parked for', async () => {
    const parked = new CacheParkedImageAdapter(memoryCache());
    await parked.park('cmd-1', image);

    await expect(parked.collect('cmd-1', 'host-a')).resolves.toEqual(image);
    await expect(parked.collect('cmd-1', 'host-a')).resolves.toBeUndefined();
  });

  it('gives another host nothing, and leaves the image for its own', async () => {
    const parked = new CacheParkedImageAdapter(memoryCache());
    await parked.park('cmd-1', image);

    await expect(parked.collect('cmd-1', 'host-b')).resolves.toBeUndefined();
    await expect(parked.collect('cmd-1', 'host-a')).resolves.toEqual(image);
  });
});
