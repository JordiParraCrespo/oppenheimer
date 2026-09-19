import type { CacheService } from '@oppenheimer/backend-cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DelegatedSessionAdapter } from '../infrastructure/delegated-session.adapter';

interface SessionRow {
  token: string;
  userId: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  delegated: boolean;
  delegatedCredentialId?: string | null;
}

/** Rows the fake adapter has "persisted", newest last. */
let rows: SessionRow[] = [];

const createSession = vi.fn();
const listSessions = vi.fn();
const deleteSessions = vi.fn();

vi.mock('../infrastructure/better-auth.config', () => ({
  auth: {
    get $context() {
      return Promise.resolve({
        internalAdapter: { createSession, listSessions, deleteSessions },
      });
    },
  },
}));

const DAY_SECONDS = 24 * 60 * 60;
const WEEK_SECONDS = 7 * DAY_SECONDS;

/**
 * Reproduces Better Auth 1.6.25's `internalAdapter.createSession` precedence
 * rather than echoing back whatever it was handed.
 *
 * That distinction is the whole point: the real implementation spreads the
 * override, then writes its **own** `expiresAt` over it — 24 hours when
 * `dontRememberMe` is set — and re-applies the override only when
 * `overrideAll` is true. A mock that returned the requested values passed
 * happily while production persisted day-long rows (issue #122), so this one
 * applies the same order of operations, including the additional-field
 * defaults (`delegated: false`) that land after the override too.
 */
function fakeAdapter() {
  let minted = 0;
  createSession.mockImplementation(
    async (
      userId: string,
      dontRememberMe?: boolean,
      override?: Record<string, unknown>,
      overrideAll?: boolean,
    ) => {
      const { id: _id, ...rest } = override ?? {};
      const row = {
        userAgent: '',
        ...rest,
        expiresAt: new Date(Date.now() + (dontRememberMe ? DAY_SECONDS : WEEK_SECONDS) * 1000),
        userId,
        token: `session-token-${++minted}`,
        createdAt: new Date(),
        delegated: false,
        ...(overrideAll ? rest : {}),
      } as SessionRow;
      rows.push(row);
      return row;
    },
  );

  listSessions.mockImplementation(
    async (userId: string, options?: { onlyActiveSessions?: boolean }) =>
      rows.filter(
        (row) =>
          row.userId === userId && (!options?.onlyActiveSessions || row.expiresAt > new Date()),
      ),
  );

  deleteSessions.mockImplementation(async (tokens: string[]) => {
    rows = rows.filter((row) => !tokens.includes(row.token));
  });
}

/** An in-memory stand-in for the Redis-backed cache. */
function fakeCache() {
  const store = new Map<string, unknown>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    reset: vi.fn(async () => store.clear()),
    // The adapter never claims a key exactly once, but the double stands in for
    // the whole `CacheService`, so it implements the primitive the interface
    // declares rather than a subset of it.
    setIfAbsent: vi.fn(async (key: string, value: unknown) => {
      if (store.has(key)) return false;
      store.set(key, value);
      return true;
    }),
  };
}

const OPTIONS = {
  credentialId: 'cred-1',
  userId: 'user-1',
  label: 'oppenheimer-api-token/abc',
};

/**
 * Backdates a row, standing in for the nine minutes that pass between a session
 * being minted and its cache entry expiring. Nothing else in these tests waits.
 */
function ageRow(token: string | null, minutes: number): void {
  rowFor(token).createdAt = new Date(Date.now() - minutes * 60_000);
}

/** The row the adapter persisted for a token, as it would be read back. */
function rowFor(token: string | null): SessionRow {
  const row = rows.find((candidate) => candidate.token === token);
  if (!row) throw new Error(`No session row was persisted for ${token}`);
  return row;
}

describe('DelegatedSessionAdapter', () => {
  let cache: ReturnType<typeof fakeCache>;
  let service: DelegatedSessionAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    rows = [];
    fakeAdapter();
    cache = fakeCache();
    service = new DelegatedSessionAdapter(cache as unknown as CacheService);
  });

  it('mints once and serves the rest from cache', async () => {
    const first = await service.resolveSessionToken(OPTIONS);
    const second = await service.resolveSessionToken(OPTIONS);

    expect(first).toBe('session-token-1');
    expect(second).toBe('session-token-1');
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it('persists the ten-minute expiry instead of Better Auth’s day', async () => {
    // The bug behind issue #122: without `overrideAll` the requested expiry is
    // spread, then overwritten, and the row outlives its purpose by 143
    // minutes short of a day.
    const token = await service.resolveSessionToken(OPTIONS);

    const lifetimeMinutes = (rowFor(token).expiresAt.getTime() - Date.now()) / 60_000;
    expect(lifetimeMinutes).toBeGreaterThan(9);
    expect(lifetimeMinutes).toBeLessThanOrEqual(10);
  });

  it('marks the row delegated and names the credential it belongs to', async () => {
    // The additional-field defaults are applied *after* the override too, so a
    // service that asked for `delegated: true` without `overrideAll` would
    // still persist `false` and put the row on the user's device list.
    const token = await service.resolveSessionToken(OPTIONS);

    expect(rowFor(token)).toMatchObject({
      delegated: true,
      delegatedCredentialId: 'cred-1',
      userAgent: 'oppenheimer-api-token/abc',
    });
  });

  it('replaces the row a remint supersedes rather than stacking rows', async () => {
    // What made one account show 23 devices: a credential in steady use
    // re-mints every nine minutes, and every previous row stayed live.
    const first = await service.resolveSessionToken(OPTIONS);
    ageRow(first, 9); // the nine minutes until its cache entry expires
    await service.invalidate('cred-1', 'user-1');
    const second = await service.resolveSessionToken(OPTIONS);

    expect(rows.map((row) => row.token)).toEqual([second]);
    expect(deleteSessions).toHaveBeenCalledWith(['session-token-1']);
  });

  it('retires only the credential’s own rows', async () => {
    const first = await service.resolveSessionToken(OPTIONS);
    await service.resolveSessionToken({ ...OPTIONS, credentialId: 'cred-2' });

    ageRow(first, 9);
    await service.invalidate('cred-1', 'user-1');
    await service.resolveSessionToken(OPTIONS);

    expect(rows.map((row) => row.delegatedCredentialId)).toEqual(['cred-2', 'cred-1']);
  });

  it('leaves a device session alone when a credential re-mints', async () => {
    // A browser sign-in carries neither marker; sweeping by user would sign
    // someone out of their laptop every nine minutes.
    rows.push({
      token: 'browser-session',
      userId: 'user-1',
      userAgent: 'Mozilla/5.0',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + WEEK_SECONDS * 1000),
      delegated: false,
      delegatedCredentialId: null,
    });

    const first = await service.resolveSessionToken(OPTIONS);
    ageRow(first, 9);
    await service.invalidate('cred-1', 'user-1');
    await service.resolveSessionToken(OPTIONS);

    expect(rows.map((row) => row.token)).toContain('browser-session');
  });

  it('leaves a sibling minted moments ago alone', async () => {
    // Two requests for one credential can miss the cache at the same instant —
    // at expiry, or throughout a Redis outage. If each sweep read the other's
    // row as superseded, both could be deleted while the cache still served one
    // of those tokens, and every façade call through the credential would fail
    // for the next nine minutes. Age is what tells a superseded row from a
    // sibling, so neither is touched here.
    const first = await service.resolveSessionToken(OPTIONS);
    await service.invalidate('cred-1', 'user-1');
    const second = await service.resolveSessionToken(OPTIONS);

    expect(rows.map((row) => row.token)).toEqual([first, second]);
    expect(deleteSessions).not.toHaveBeenCalled();
  });

  it('still hands back the token when the sweep fails', async () => {
    // A tidy table is not worth a failed request.
    listSessions.mockRejectedValue(new Error('database down'));

    await expect(service.resolveSessionToken(OPTIONS)).resolves.toBe('session-token-1');
  });

  it('re-mints for the whole user after a bulk revocation', async () => {
    // The revoked session row is gone; serving the cached token would fail
    // every façade call until the entry expired on its own.
    await service.resolveSessionToken(OPTIONS);

    await service.invalidateForUser('user-1');

    expect(await service.resolveSessionToken(OPTIONS)).toBe('session-token-2');
    expect(createSession).toHaveBeenCalledTimes(2);
  });

  it('evicts every credential the user holds, not just one', async () => {
    // The point of the generation stamp: no enumeration of API tokens and OAuth
    // grants is needed to reach them all.
    await service.resolveSessionToken(OPTIONS);
    await service.resolveSessionToken({ ...OPTIONS, credentialId: 'cred-2' });
    expect(createSession).toHaveBeenCalledTimes(2);

    await service.invalidateForUser('user-1');

    await service.resolveSessionToken(OPTIONS);
    await service.resolveSessionToken({ ...OPTIONS, credentialId: 'cred-2' });
    expect(createSession).toHaveBeenCalledTimes(4);
  });

  it('leaves another user’s cached sessions alone', async () => {
    const other = { ...OPTIONS, credentialId: 'cred-9', userId: 'user-2' };
    await service.resolveSessionToken(other);

    await service.invalidateForUser('user-1');

    expect(await service.resolveSessionToken(other)).toBe('session-token-1');
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it('still drops a single revoked credential', async () => {
    await service.resolveSessionToken(OPTIONS);

    await service.invalidate('cred-1', 'user-1');

    expect(await service.resolveSessionToken(OPTIONS)).toBe('session-token-2');
  });

  it('does not resurrect a retired entry when the cache read fails', async () => {
    // Falling back to the initial generation here would serve a token a bump
    // had already retired.
    await service.resolveSessionToken(OPTIONS);
    await service.invalidateForUser('user-1');
    cache.get.mockRejectedValue(new Error('redis down'));

    expect(await service.resolveSessionToken(OPTIONS)).toBe('session-token-2');
  });

  it('mints rather than failing when the cache is unavailable', async () => {
    cache.get.mockRejectedValue(new Error('redis down'));
    cache.set.mockRejectedValue(new Error('redis down'));

    await expect(service.resolveSessionToken(OPTIONS)).resolves.toBe('session-token-1');
  });

  it('reports no token when a session cannot be minted', async () => {
    // Callers fall back to scope-only access rather than failing the request.
    createSession.mockRejectedValue(new Error('database down'));

    await expect(service.resolveSessionToken(OPTIONS)).resolves.toBeNull();
  });
});
