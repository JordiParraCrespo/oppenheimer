import type { ConfigService } from '@nestjs/config';
import type { CacheService } from '@oppenheimer/backend-cache';
import type { StorageService } from '@oppenheimer/backend-storage';
import { describe, expect, it } from 'vitest';
import { StorageCloudFilesAdapter } from '../infrastructure/storage-cloud-files.adapter';

/**
 * What a cloud session's agent can download: a file kept under its session,
 * through a link that names it until the link expires. The sample link a
 * create measures a task with is pinned to the shape `link` answers. The route and the task's wording are the handler specs'.
 */

function memoryCache(): CacheService {
  const store = new Map<string, unknown>();
  return {
    get: async (key: string) => store.get(key),
    set: async (key: string, value: unknown) => void store.set(key, value),
    del: async (key: string) => void store.delete(key),
  } as unknown as CacheService;
}

function memoryStorage() {
  const objects = new Map<string, Buffer>();
  const storage = {
    upload: async (file: Buffer, key: string) => {
      objects.set(key, file);
      return key;
    },
    download: async (key: string) => {
      const found = objects.get(key);
      if (!found) throw new Error('NoSuchKey');
      return found;
    },
    delete: async (key: string) => void objects.delete(key),
    getUrl: async (key: string) => key,
  } satisfies StorageService;
  return { storage, objects };
}

function adapter(cache = memoryCache()) {
  const { storage, objects } = memoryStorage();
  const config = {
    get: () => 'https://api.example.com/',
  } as unknown as ConfigService;
  return { files: new StorageCloudFilesAdapter(storage, cache, config), objects, cache };
}

const owner = { organizationId: 'org-1', sessionId: 'session-1' };
const png = { mediaType: 'image/png' as const, data: Buffer.from([0x89, 0x50, 0x4e, 0x47]) };

describe('StorageCloudFilesAdapter', () => {
  it('keeps each file under its workspace and session, and serves it through a link', async () => {
    const { files, objects } = adapter();

    const [kept] = await files.keep(owner, [png]);
    expect([...objects.keys()]).toEqual([`cloud-files/org-1/session-1/${kept?.imageId}`]);

    const url = await files.link(owner, kept as NonNullable<typeof kept>);
    expect(url).toMatch(/^https:\/\/api\.example\.com\/api\/v1\/cloud-files\/[0-9a-f-]{36}$/);
    // The sample a task is measured with has the shape of every real link.
    expect(url).toHaveLength(files.sampleLink().length);

    const token = url.split('/').pop() as string;
    await expect(files.open(token)).resolves.toEqual(png);
    // Not taken on read: the agent may download it again.
    await expect(files.open(token)).resolves.toEqual(png);
  });

  it('mints a fresh link per launch, each naming the same file', async () => {
    const { files } = adapter();
    const [kept] = await files.keep(owner, [png]);
    const file = kept as NonNullable<typeof kept>;

    const first = await files.link(owner, file);
    const second = await files.link(owner, file);

    expect(second).not.toBe(first);
    await expect(files.open(second.split('/').pop() as string)).resolves.toEqual(png);
  });

  it('opens nothing for a link never minted, or one whose file is gone', async () => {
    const { files, objects } = adapter();
    const [kept] = await files.keep(owner, [png]);
    const url = await files.link(owner, kept as NonNullable<typeof kept>);

    await expect(files.open('00000000-0000-4000-8000-000000000000')).resolves.toBeUndefined();
    objects.clear();
    await expect(files.open(url.split('/').pop() as string)).resolves.toBeUndefined();
  });
});
