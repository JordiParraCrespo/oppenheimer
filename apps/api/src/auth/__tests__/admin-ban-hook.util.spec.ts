import { describe, expect, it, vi } from 'vitest';
import { RotateDelegatedSessionsCommand } from '../commands/rotate-delegated-sessions/rotate-delegated-sessions.command';
import { RotateDelegatedSessionsCommandHandler } from '../commands/rotate-delegated-sessions/rotate-delegated-sessions.command-handler';
import { standingChangeOf } from '../infrastructure/admin-ban-hook.util';
import type { DelegatedSessionPort } from '../infrastructure/delegated-session.port';

/**
 * A ban made straight through Better Auth's admin plugin bypasses
 * the admin module, so the after-hook is what rotates the account's delegated
 * sessions. It must fire for a ban or an unban that happened, and for nothing
 * else.
 */
describe('standingChangeOf', () => {
  const USER = '0f1e2d3c-4b5a-4968-8776-655443322110';

  it('names the account a successful ban or unban changed', () => {
    for (const path of ['/admin/ban-user', '/admin/unban-user']) {
      expect(standingChangeOf({ path, body: { userId: USER }, returned: { user: {} } })).toBe(USER);
    }
  });

  it('ignores a ban the plugin refused', () => {
    expect(
      standingChangeOf({
        path: '/admin/ban-user',
        body: { userId: USER },
        returned: new Error('FORBIDDEN'),
      }),
    ).toBeNull();
    expect(standingChangeOf({ path: '/admin/ban-user', body: { userId: USER } })).toBeNull();
  });

  it('ignores every other endpoint, and a body with no usable id', () => {
    expect(
      standingChangeOf({ path: '/admin/set-role', body: { userId: USER }, returned: {} }),
    ).toBeNull();
    expect(standingChangeOf({ path: undefined, body: { userId: USER }, returned: {} })).toBeNull();
    expect(standingChangeOf({ path: '/admin/ban-user', body: {}, returned: {} })).toBeNull();
    expect(
      standingChangeOf({ path: '/admin/ban-user', body: { userId: 42 }, returned: {} }),
    ).toBeNull();
    expect(standingChangeOf({ path: '/admin/ban-user', body: null, returned: {} })).toBeNull();
  });
});

describe('RotateDelegatedSessionsCommandHandler', () => {
  it("rotates the account's delegated-session generation", async () => {
    const delegated = { invalidateForUser: vi.fn().mockResolvedValue(undefined) };
    const handler = new RotateDelegatedSessionsCommandHandler(
      delegated as unknown as DelegatedSessionPort,
    );

    await handler.execute(new RotateDelegatedSessionsCommand({ userId: 'user-1' }));

    expect(delegated.invalidateForUser).toHaveBeenCalledWith('user-1');
  });
});
