import type { CacheService } from '@oppenheimer/backend-cache';
import { describe, expect, it } from 'vitest';
import {
  CacheParkedImageAdapter,
  STAGED_IMAGES_PER_OWNER,
} from '../infrastructure/cache-parked-image.adapter';

/** A cache with `take` as one read-and-delete, which is all the adapter relies on. */
function memoryCache(): CacheService {
  const store = new Map<string, unknown>();
  return {
    get: async (key: string) => store.get(key),
    mget: async (keys: string[]) => keys.map((key) => store.get(key)),
    set: async (key: string, value: unknown) => void store.set(key, value),
    take: async (key: string) => {
      const value = store.get(key);
      store.delete(key);
      return value;
    },
    del: async (key: string) => void store.delete(key),
    setIfAbsent: async () => true,
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

  describe('staged uploads', () => {
    const owner = { organizationId: 'org-1', userId: 'user-1' };
    const png = (byte: number) => ({
      ...owner,
      mediaType: 'image/png' as const,
      data: Buffer.from([0x89, 0x50, byte]),
    });

    it('names an upload by its owner and bytes, so a second upload is the same id', async () => {
      const store = new CacheParkedImageAdapter(memoryCache());

      const first = await store.stage(png(1));
      expect(first).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      await expect(store.stage(png(1))).resolves.toBe(first);
      await expect(store.stage({ ...png(1), userId: 'user-2' })).resolves.not.toBe(first);
    });

    it('names the same text staged as two types twice, so neither takes the other’s type', async () => {
      const store = new CacheParkedImageAdapter(memoryCache());
      const text = { ...owner, data: Buffer.from('a,b\n') };

      const asCsv = await store.stage({ ...text, mediaType: 'text/csv' });
      const asPlain = await store.stage({ ...text, mediaType: 'text/plain' });

      expect(asPlain).not.toBe(asCsv);
      const claimed = await store.claim([asCsv as string], owner, {
        hostId: 'host-1',
        sessionId: 'session-1',
      });
      expect(claimed?.[0]?.mediaType).toBe('text/csv');
    });

    it('refuses an upload past the per-person cap, but not the same bytes again', async () => {
      const store = new CacheParkedImageAdapter(memoryCache());
      for (let i = 0; i < STAGED_IMAGES_PER_OWNER; i += 1) {
        await expect(store.stage(png(i))).resolves.toBeDefined();
      }

      await expect(store.stage(png(99))).resolves.toBeUndefined();
      await expect(store.stage(png(0))).resolves.toBeDefined();
    });

    it('parks a copy for a host under a fresh id, and keeps the upload for a retry', async () => {
      const store = new CacheParkedImageAdapter(memoryCache());
      const id = (await store.stage(png(1))) as string;

      const claimed = await store.claim([id], owner, { hostId: 'host-a', sessionId: 's-1' });

      expect(claimed).toHaveLength(1);
      const [{ imageId }] = claimed ?? [];
      expect(imageId).not.toBe(id);
      await expect(store.collect(imageId as string, 'host-a')).resolves.toMatchObject({
        sessionId: 's-1',
        data: png(1).data,
      });
      // Still staged: a create that failed after the claim can be sent again.
      await expect(
        store.claim([id], owner, { hostId: 'host-a', sessionId: 's-1' }),
      ).resolves.toHaveLength(1);
    });

    it('claims nothing another person staged, and nothing that is gone', async () => {
      const store = new CacheParkedImageAdapter(memoryCache());
      const id = (await store.stage(png(1))) as string;
      const target = { hostId: 'host-a', sessionId: 's-1' };

      await expect(
        store.claim([id], { ...owner, userId: 'user-2' }, target),
      ).resolves.toBeUndefined();
      await expect(store.claim([id, 'missing'], owner, target)).resolves.toBeUndefined();
    });
  });
});
