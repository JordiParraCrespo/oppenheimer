import type { CacheService } from '@oppenheimer/backend-cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INSTALL_STATE_PREFIX,
  INSTALL_STATE_TTL_SECONDS,
  InstallStateResolver,
} from '../install-state.resolver';

/**
 * The state is the only thing tying a GitHub install redirect to the console
 * user whose browser posts it, so the properties that matter are the ones a
 * replayed or forwarded callback would lean on: single use, bound to one person
 * in one workspace, and the same refusal whichever of those failed.
 */

/** `setIfAbsent` / `take` over a Map, with the TTL each key was written with. */
function memoryCache() {
  const store = new Map<string, unknown>();
  const ttls = new Map<string, number>();
  return {
    store,
    ttls,
    setIfAbsent: vi.fn(async (key: string, value: unknown, ttlSeconds: number) => {
      if (store.has(key)) return false;
      store.set(key, value);
      ttls.set(key, ttlSeconds);
      return true;
    }),
    take: vi.fn(async (key: string) => {
      const value = store.get(key);
      store.delete(key);
      return value;
    }),
  };
}

describe('InstallStateResolver', () => {
  let cache: ReturnType<typeof memoryCache>;
  let resolver: InstallStateResolver;

  beforeEach(() => {
    cache = memoryCache();
    resolver = new InstallStateResolver(cache as unknown as CacheService);
  });

  it('mints a base64url state bound to the person and the workspace, for 900 seconds', async () => {
    const before = Date.now();
    const { state, expiresAt } = await resolver.mint('ana', 'org-acme');

    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const key = `${INSTALL_STATE_PREFIX}${state}`;
    expect(cache.store.get(key)).toEqual({ userId: 'ana', organizationId: 'org-acme' });
    expect(cache.ttls.get(key)).toBe(INSTALL_STATE_TTL_SECONDS);
    expect(INSTALL_STATE_TTL_SECONDS).toBe(900);
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 900_000);
  });

  it('mints a different state every time', async () => {
    const first = await resolver.mint('ana', 'org-acme');
    const second = await resolver.mint('ana', 'org-acme');

    expect(first.state).not.toBe(second.state);
  });

  it('redeems once, and refuses the second time', async () => {
    const { state } = await resolver.mint('ana', 'org-acme');

    await expect(resolver.redeem(state, 'ana', 'org-acme')).resolves.toBeUndefined();
    expect(cache.store.size).toBe(0);
    await expect(resolver.redeem(state, 'ana', 'org-acme')).rejects.toMatchObject({
      code: 'GITHUB_011',
    });
  });

  it('refuses a state it never minted', async () => {
    await expect(resolver.redeem('never-minted-state', 'ana', 'org-acme')).rejects.toMatchObject({
      code: 'GITHUB_011',
    });
  });

  it('refuses another person, and spends the state doing so', async () => {
    const { state } = await resolver.mint('ana', 'org-acme');

    await expect(resolver.redeem(state, 'mallory', 'org-acme')).rejects.toMatchObject({
      code: 'GITHUB_011',
    });
    // Consumed on a mismatch too: the rightful owner cannot now be raced, and a
    // wrong guess cannot be retried against the same key.
    await expect(resolver.redeem(state, 'ana', 'org-acme')).rejects.toMatchObject({
      code: 'GITHUB_011',
    });
  });

  it('refuses another workspace, even for the same person', async () => {
    const { state } = await resolver.mint('ana', 'org-acme');

    await expect(resolver.redeem(state, 'ana', 'org-other')).rejects.toMatchObject({
      code: 'GITHUB_011',
    });
    expect(cache.store.size).toBe(0);
  });

  it('says nothing about which check failed', async () => {
    const { state } = await resolver.mint('ana', 'org-acme');
    const errors = await Promise.all([
      resolver.redeem('never-minted-state', 'ana', 'org-acme').catch((e: unknown) => e),
      resolver.redeem(state, 'mallory', 'org-acme').catch((e: unknown) => e),
    ]);

    const [unknown, mismatch] = errors as { code: string; detail?: string }[];
    expect(unknown.code).toBe(mismatch.code);
    expect(unknown.detail).toBe(mismatch.detail);
  });
});
