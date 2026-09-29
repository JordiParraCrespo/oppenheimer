import { describe, expect, it, vi } from 'vitest';
import type { AdminAuthPort } from '../../../infrastructure/admin-auth.port';
import { RevokeUserSessionCommand } from '../revoke-user-session.command';
import { RevokeUserSessionCommandHandler } from '../revoke-user-session.command-handler';

describe('RevokeUserSessionCommandHandler', () => {
  it('revokes the session the client named by id', async () => {
    const headers = { cookie: 'session=abc' };
    const admin = { revokeSessionById: vi.fn().mockResolvedValue({ success: true }) };
    const handler = new RevokeUserSessionCommandHandler(admin as unknown as AdminAuthPort);

    const result = await handler.execute(
      new RevokeUserSessionCommand({ headers, userId: 'u1', sessionId: 's2' }),
    );

    expect(result).toEqual({ success: true });
    expect(admin.revokeSessionById).toHaveBeenCalledWith(headers, 'u1', 's2');
  });
});
