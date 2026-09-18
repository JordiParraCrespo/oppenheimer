import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnedSession, SessionReaderPort } from '../../../database/session.repository.port';
import type { ProfileAuthGateway } from '../../../infrastructure/profile-auth.gateway';
import { RevokeSessionCommand } from '../revoke-session.command';
import { RevokeSessionCommandHandler } from '../revoke-session.command-handler';

const OWNED: OwnedSession = {
  id: 'session-2',
  userId: 'user-uuid',
  token: 'session-2-token',
  ipAddress: '10.0.0.2',
  userAgent: 'Safari',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  expiresAt: new Date('2026-03-01'),
};

function command(overrides: Partial<ConstructorParameters<typeof RevokeSessionCommand>[0]> = {}) {
  return new RevokeSessionCommand({
    headers: { cookie: 'session=abc' },
    userId: 'user-uuid',
    sessionId: 'session-2',
    currentSessionId: 'session-1',
    ...overrides,
  });
}

describe('RevokeSessionCommandHandler', () => {
  let sessions: Pick<SessionReaderPort, 'findOneById'>;
  let profileAuth: { revokeSession: ReturnType<typeof vi.fn> };
  let service: RevokeSessionCommandHandler;

  beforeEach(() => {
    sessions = { findOneById: vi.fn().mockResolvedValue(Some(OWNED)) };
    profileAuth = { revokeSession: vi.fn().mockResolvedValue(undefined) };
    service = new RevokeSessionCommandHandler(
      sessions as SessionReaderPort,
      profileAuth as unknown as ProfileAuthGateway,
    );
  });

  it('revokes by the token it looked up, never one supplied by the caller', async () => {
    await service.execute(command());

    expect(profileAuth.revokeSession).toHaveBeenCalledWith(
      { cookie: 'session=abc' },
      'session-2-token',
    );
  });

  it('refuses to revoke the session making the request', async () => {
    // Signing yourself out mid-request is indistinguishable from a failure;
    // that is what the sign-out endpoint is for.
    const error = await service
      .execute(command({ sessionId: 'session-1' }))
      .catch((e) => e as AppError);

    expect((error as AppError).code).toBe('PROFILE_007');
    expect(sessions.findOneById).not.toHaveBeenCalled();
    expect(profileAuth.revokeSession).not.toHaveBeenCalled();
  });

  it('reports an unknown session as not found', async () => {
    sessions.findOneById = vi.fn().mockResolvedValue(None);

    const error = await service.execute(command()).catch((e) => e as AppError);

    expect((error as AppError).code).toBe('PROFILE_003');
  });

  it('reports someone else’s session as not found, not forbidden', async () => {
    // Distinguishing the two would confirm that a session id exists.
    sessions.findOneById = vi.fn().mockResolvedValue(Some({ ...OWNED, userId: 'someone-else' }));

    const error = await service.execute(command()).catch((e) => e as AppError);

    expect((error as AppError).code).toBe('PROFILE_003');
    expect(profileAuth.revokeSession).not.toHaveBeenCalled();
  });

  it('still revokes when the caller has no session of its own', async () => {
    // A caller with no current session id cannot be revoking itself, so the
    // self-revocation guard must not fire on the missing value.
    await service.execute(command({ currentSessionId: null }));

    expect(profileAuth.revokeSession).toHaveBeenCalled();
  });
});
