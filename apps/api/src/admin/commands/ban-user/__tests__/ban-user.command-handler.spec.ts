import { describe, expect, it, vi } from 'vitest';
import type { AdminAuthPort } from '../../../infrastructure/admin-auth.port';
import { BanUserCommand } from '../ban-user.command';
import { BanUserCommandHandler } from '../ban-user.command-handler';

describe('BanUserCommandHandler', () => {
  it('bans the account with the reason and expiry the administrator gave', async () => {
    const admin = { ban: vi.fn().mockResolvedValue({ id: 'u1' }) };
    const headers = { cookie: 'session=abc' };

    await new BanUserCommandHandler(admin as unknown as AdminAuthPort).execute(
      new BanUserCommand({ headers, userId: 'u1', banReason: 'abuse', banExpiresIn: 3600 }),
    );

    expect(admin.ban).toHaveBeenCalledWith(headers, 'u1', {
      banReason: 'abuse',
      banExpiresIn: 3600,
    });
  });
});
