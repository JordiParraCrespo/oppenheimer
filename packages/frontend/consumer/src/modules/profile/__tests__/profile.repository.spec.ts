import { ProfileApi } from '@oppenheimer/api-client';
import { AppError } from '@oppenheimer/frontend-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileRepository } from '../profile.repository';

vi.mock('@oppenheimer/api-client', () => ({
  ProfileApi: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    uploadAvatar: vi.fn(),
    deleteAvatar: vi.fn(),
    changePassword: vi.fn(),
    findSessions: vi.fn(),
    revokeSession: vi.fn(),
    revokeOtherSessions: vi.fn(),
  },
}));

const PROFILE = {
  id: 'user-1',
  email: 'adri@example.com',
  firstName: 'Adri',
  lastName: 'Rodrigo',
  phone: '+34 600 123 456',
  jobTitle: 'Founder',
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
    vi.mocked(ProfileApi.getProfile).mockResolvedValue(PROFILE as never);

    const profile = await repository.get();

    expect(profile.fullName).toBe('Adri Rodrigo');
    expect(profile.initials).toBe('AR');
    expect(profile.phone).toBe('+34 600 123 456');
    expect(profile.twoFactorEnabled).toBe(false);
    expect(profile.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('maps a session’s updatedAt onto lastSeenAt', async () => {
    // The wire calls it `updatedAt`; every screen would otherwise repeat the
    // translation to "last seen".
    vi.mocked(ProfileApi.findSessions).mockResolvedValue([
      {
        id: 'session-1',
        ipAddress: '10.0.0.1',
        userAgent: 'Chrome',
        current: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
        expiresAt: '2026-03-01T00:00:00.000Z',
      },
    ] as never);

    const [session] = await repository.getSessions();

    expect(session.lastSeenAt).toEqual(new Date('2026-02-01T00:00:00.000Z'));
    expect(session.current).toBe(true);
  });

  it('treats an empty session list as no sessions', async () => {
    vi.mocked(ProfileApi.findSessions).mockResolvedValue(undefined as never);

    await expect(repository.getSessions()).resolves.toEqual([]);
  });

  it('maps a transport failure onto its declared error', async () => {
    vi.mocked(ProfileApi.getProfile).mockRejectedValue(new Error('network down'));

    const error = await repository.get().catch((e) => e as AppError);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('PROFILE_CLIENT_001');
  });

  it('sends the avatar as a multipart file field', async () => {
    vi.mocked(ProfileApi.uploadAvatar).mockResolvedValue(PROFILE as never);
    const file = { type: 'image/png', size: 10 } as Blob;

    await repository.uploadAvatar(file);

    expect(ProfileApi.uploadAvatar).toHaveBeenCalledWith({ file });
  });
});
