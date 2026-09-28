import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminAuthPort } from '../../../infrastructure/admin-auth.port';
import { RevokeUserSessionCommand } from '../revoke-user-session.command';
import { RevokeUserSessionCommandHandler } from '../revoke-user-session.command-handler';

const headers = { cookie: 'session=abc' };

describe('RevokeUserSessionCommandHandler', () => {
  const admin = {
    sessionToken: vi.fn(),
    revokeSession: vi.fn(),
  };
  let handler: RevokeUserSessionCommandHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new RevokeUserSessionCommandHandler(admin as unknown as AdminAuthPort);
  });

  it('revokes the session by the token the id resolves to', async () => {
    admin.sessionToken.mockResolvedValue('token-2');
    admin.revokeSession.mockResolvedValue({ success: true });

    const result = await handler.execute(
      new RevokeUserSessionCommand({ headers, userId: 'u1', sessionId: 's2' }),
    );

    expect(result).toEqual({ success: true });
    expect(admin.sessionToken).toHaveBeenCalledWith(headers, 'u1', 's2');
    // The client named a session id; the raw token never left the API.
    expect(admin.revokeSession).toHaveBeenCalledWith(headers, 'token-2');
  });

  it('answers SESSION_NOT_FOUND when the id is not one of the user’s sessions', async () => {
    admin.sessionToken.mockResolvedValue(null);

    await expect(
      handler.execute(new RevokeUserSessionCommand({ headers, userId: 'u1', sessionId: 'nope' })),
    ).rejects.toMatchObject({ code: 'ADMIN_009' });
    expect(admin.revokeSession).not.toHaveBeenCalled();
  });
});
