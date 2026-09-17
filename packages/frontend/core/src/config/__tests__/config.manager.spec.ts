import { describe, expect, it, vi } from 'vitest';
import { ConfigManager } from '../config.manager';

type Cfg = { version: number; flag: boolean; nested: { n: number } };

describe('ConfigManager', () => {
  it('starts from static config when the cache is empty', () => {
    const manager = new ConfigManager<Cfg>({
      staticConfig: { version: 1, flag: false, nested: { n: 1 } },
    });
    expect(manager.getAll()).toEqual({ version: 1, flag: false, nested: { n: 1 } });
  });

  it('merges a cached document over static values', () => {
    const manager = new ConfigManager<Cfg>({
      staticConfig: { version: 1, flag: false, nested: { n: 1 } },
      storage: {
        read: () => ({ flag: true, nested: { n: 2 } }),
        write: () => {},
      },
    });
    expect(manager.getAll()).toEqual({ version: 1, flag: true, nested: { n: 2 } });
  });

  it('refuses a remote document whose minRequiredVersion is above this build', async () => {
    const write = vi.fn();
    const manager = new ConfigManager<Cfg>({
      staticConfig: { version: 1, flag: false, nested: { n: 1 } },
      storage: { read: () => undefined, write },
      provider: {
        fetch: async () => ({ minRequiredVersion: 2, flag: true }),
      },
    });
    await manager.load();
    expect(manager.getAll().flag).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it('does not reject when the provider throws', async () => {
    const manager = new ConfigManager<Cfg>({
      staticConfig: { version: 1, flag: false, nested: { n: 1 } },
      provider: {
        fetch: async () => {
          throw new Error('offline');
        },
      },
    });
    await expect(manager.load()).resolves.toBeUndefined();
    expect(manager.getAll().flag).toBe(false);
  });

  it('dedupes concurrent load() calls', async () => {
    const fetch = vi.fn(async () => ({ flag: true }));
    const manager = new ConfigManager<Cfg>({
      staticConfig: { version: 1, flag: false, nested: { n: 1 } },
      provider: { fetch },
    });
    await Promise.all([manager.load(), manager.load()]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
