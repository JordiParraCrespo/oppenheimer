import { describe, expect, it, vi } from 'vitest';
import { HOOK_ROW_CAP, sessionDeleteHooks } from '../infrastructure/session-delete-hook.util';

/**
 * The `session.delete` hooks: every copy of a deleted row leaves Redis, even
 * when Better Auth hands the hook only the first hundred rows of a bulk delete.
 */
describe('sessionDeleteHooks', () => {
  const tokens = (count: number) => Array.from({ length: count }, (_, i) => `t-${i}`);

  const hooksFor = (rows: string[]) => {
    const evicted: string[] = [];
    const deps = {
      tokensOf: vi.fn(async () => rows),
      evict: vi.fn(async (token: string) => {
        evicted.push(token);
      }),
    };
    return { hooks: sessionDeleteHooks(deps), deps, evicted };
  };

  it('evicts only the row it is handed for a user within the cap', async () => {
    const { hooks, evicted } = hooksFor(tokens(3));

    await hooks.before({ token: 't-1', userId: 'u' });

    expect(evicted).toEqual(['t-1']);
  });

  it('evicts every row of a user holding more rows than Better Auth reads', async () => {
    const rows = tokens(HOOK_ROW_CAP + 50);
    const { hooks, evicted } = hooksFor(rows);

    // Better Auth calls `before` for the first hundred rows only.
    for (const token of rows.slice(0, HOOK_ROW_CAP)) await hooks.before({ token, userId: 'u' });

    expect(new Set(evicted)).toEqual(new Set(rows));
  });

  it('sweeps once per delete, and again for the next one', async () => {
    const rows = tokens(HOOK_ROW_CAP + 1);
    const { hooks, deps } = hooksFor(rows);

    for (const token of rows.slice(0, HOOK_ROW_CAP)) await hooks.before({ token, userId: 'u' });
    expect(deps.tokensOf).toHaveBeenCalledTimes(1);

    hooks.after({ userId: 'u' });
    await hooks.before({ token: 't-0', userId: 'u' });
    expect(deps.tokensOf).toHaveBeenCalledTimes(2);
  });

  it('propagates a failed eviction, and does not reuse a failed sweep', async () => {
    const { hooks, deps } = hooksFor(tokens(HOOK_ROW_CAP + 1));
    deps.evict.mockImplementation(async (token: string) => {
      if (token === 't-100') throw new Error('redis down');
    });

    await expect(hooks.before({ token: 't-0', userId: 'u' })).rejects.toThrow('redis down');

    deps.evict.mockResolvedValue(undefined);
    await expect(hooks.before({ token: 't-0', userId: 'u' })).resolves.toBeUndefined();
    expect(deps.tokensOf).toHaveBeenCalledTimes(2);
  });
});
