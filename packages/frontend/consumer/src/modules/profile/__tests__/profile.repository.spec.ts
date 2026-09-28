import { heyApiSdk } from '@oppenheimer/api-client';
import { AppError } from '@oppenheimer/frontend-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileRepository } from '../profile.repository';

vi.mock('@oppenheimer/api-client', () => ({
  heyApiSdk: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    uploadAvatar: vi.fn(),
    deleteAvatar: vi.fn(),
    changePassword: vi.fn(),
    changeEmail: vi.fn(),
    deleteOwnAccount: vi.fn(),
    findProfileSessions: vi.fn(),
    revokeProfileSession: vi.fn(),
    revokeOtherSessions: vi.fn(),
  },
}));

/** What the generated SDK resolves to on success. */
const ok = (data: unknown) => ({ data, response: { status: 200 } }) as never;

const PROFILE = {
  id: 'user-1',
  email: 'adri@example.com',
  firstName: 'Adri',
  lastName: 'Rodrigo',
  phone: '+34 600 123 456',
  jobTitle: 'Founder',
  username: 'adri',
  avatarUrl: 'https://cdn.example.com/a.png',
  role: 'owner',
  emailVerified: true,
  twoFactorEnabled: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
};

describe('ProfileRepository', () => {
  let repository: ProfileRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ProfileRepository();
  });

  it('maps the profile response onto the entity', async () => {
    vi.mocked(heyApiSdk.getProfile).mockResolvedValue(ok(PROFILE));

    const profile = await repository.get();

    expect(profile.fullName).toBe('Adri Rodrigo');
    expect(profile.initials).toBe('AR');
    expect(profile.phone).toBe('+34 600 123 456');
    expect(profile.username).toBe('adri');
    expect(profile.twoFactorEnabled).toBe(false);
    expect(profile.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('maps a session’s updatedAt onto lastSeenAt', async () => {
    // The wire calls it `updatedAt`; every screen would otherwise repeat the
    // translation to "last seen".
    vi.mocked(heyApiSdk.findProfileSessions).mockResolvedValue(
      ok([
        {
          id: 'session-1',
          ipAddress: '10.0.0.1',
          userAgent: 'Chrome',
          current: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z',
          expiresAt: '2026-03-01T00:00:00.000Z',
        },
      ]),
    );

    const [session] = await repository.getSessions();

    expect(session.lastSeenAt).toEqual(new Date('2026-02-01T00:00:00.000Z'));
    expect(session.current).toBe(true);
  });

  it('treats an absent body as a failed read, not an empty list', async () => {
    vi.mocked(heyApiSdk.findProfileSessions).mockResolvedValue(ok(undefined));

    const error = await repository.getSessions().catch((e) => e as AppError);

    expect((error as AppError).code).toBe('PROFILE_CLIENT_008');
  });

  it('maps a transport failure onto its declared error', async () => {
    vi.mocked(heyApiSdk.getProfile).mockRejectedValue(new Error('network down'));

    const error = await repository.get().catch((e) => e as AppError);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('PROFILE_CLIENT_001');
  });

  it('sends the avatar as a multipart file field', async () => {
    vi.mocked(heyApiSdk.uploadAvatar).mockResolvedValue(ok(PROFILE));
    const file = { type: 'image/png', size: 10 } as Blob;

    await repository.uploadAvatar(file);

    expect(heyApiSdk.uploadAvatar).toHaveBeenCalledWith({ body: { file } });
  });

  it('asks for the email change with the new address', async () => {
    vi.mocked(heyApiSdk.changeEmail).mockResolvedValue(ok(undefined));

    await repository.changeEmail({ newEmail: 'new@example.com' });

    expect(heyApiSdk.changeEmail).toHaveBeenCalledWith({ body: { newEmail: 'new@example.com' } });
  });

  it('keeps the problem the API sent when deleting the account is refused', async () => {
    vi.mocked(heyApiSdk.deleteOwnAccount).mockResolvedValue({
      error: {
        type: 'https://oppenheimer.dev/errors#user_003',
        title: 'The confirmation does not match your email address',
        status: 400,
        code: 'USER_003',
      },
      response: { status: 400 },
    } as never);

    const error = await repository
      .deleteAccount({ confirmation: 'nope' })
      .catch((e) => e as AppError);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('USER_003');
  });
});
