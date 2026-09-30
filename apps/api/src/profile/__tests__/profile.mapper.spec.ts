import { describe, expect, it } from 'vitest';
import { UserEntity } from '../../users/domain/user.entity';
import { Email } from '../../users/domain/value-objects/email.value-object';
import { UserSettingsOrmEntity } from '../database/user-settings.orm-entity';
import { UserSettingsEntity } from '../domain/user-settings.entity';
import { ProfileMapper, type SessionRecord } from '../profile.mapper';

function makeUser() {
  return UserEntity.create({
    id: 'user-uuid',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-02-01'),
    props: {
      email: new Email({ value: 'adri@example.com' }),
      firstName: 'Adri',
      lastName: 'Rodrigo',
      phone: '+34 600 123 456',
      jobTitle: 'Founder',
      username: null,
      avatarUrl: 'avatars/user-uuid.png',
      role: 'owner',
      isActive: true,
      emailVerified: true,
      banned: false,
      banExpires: null,
    },
  });
}

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 'session-1',
    ipAddress: '10.0.0.1',
    userAgent: 'Chrome',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    expiresAt: new Date('2026-03-01'),
    ...overrides,
  };
}

describe('ProfileMapper', () => {
  const mapper = new ProfileMapper();

  describe('settings', () => {
    it('round-trips an aggregate through persistence', () => {
      const settings = UserSettingsEntity.create({
        id: 'user-uuid',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        props: {
          theme: 'dark',
          locale: 'en',
          density: 'compact',
          weeklyDigest: false,
          productUpdates: true,
        },
      });

      const record = mapper.toPersistence(settings);
      // Timestamps are database-managed columns, so they are not written back.
      record.createdAt = settings.createdAt;
      record.updatedAt = settings.updatedAt;

      expect(mapper.toDomain(record).getProps()).toEqual(settings.getProps());
    });

    it('maps a record to the response shape', () => {
      const record = new UserSettingsOrmEntity();
      record.userId = 'user-uuid';
      record.theme = 'light';
      record.locale = 'es';
      record.density = 'comfortable';
      record.weeklyDigest = true;
      record.productUpdates = false;
      record.createdAt = new Date('2026-01-01');
      record.updatedAt = new Date('2026-01-02');

      expect(mapper.toResponse(mapper.toDomain(record))).toEqual({
        userId: 'user-uuid',
        theme: 'light',
        locale: 'es',
        density: 'comfortable',
        weeklyDigest: true,
        productUpdates: false,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      });
    });
  });

  describe('toProfileResponse', () => {
    it('takes the avatar URL from the caller, not the stored key', () => {
      // What is persisted is a storage key; only the caller has resolved it
      // against the storage back-end.
      const dto = mapper.toProfileResponse(makeUser(), 'https://cdn.example.com/a.png?sig=1');

      expect(dto.avatarUrl).toBe('https://cdn.example.com/a.png?sig=1');
    });

    it('carries the contact details the user directory withholds', () => {
      const dto = mapper.toProfileResponse(makeUser(), null);

      expect(dto).toMatchObject({
        id: 'user-uuid',
        email: 'adri@example.com',
        firstName: 'Adri',
        lastName: 'Rodrigo',
        phone: '+34 600 123 456',
        jobTitle: 'Founder',
        emailVerified: true,
      });
    });

    it('reports two-factor authentication as off', () => {
      // The plugin is not enabled on this deployment; the field exists so a
      // client can render the control without probing for it.
      expect(mapper.toProfileResponse(makeUser(), null).twoFactorEnabled).toBe(false);
    });

    it('never falls back to the stored key when the caller resolved no URL', () => {
      // The user holds a storage key; a key is not something a browser can load.
      expect(mapper.toProfileResponse(makeUser(), null).avatarUrl).toBeNull();
    });
  });

  describe('toSessionResponse', () => {
    it.each([
      ['session-1', true],
      ['session-2', false],
      // The scoped-credential path has no device session — claiming one of the
      // user's real devices is "current" would offer the wrong affordance.
      [null, false],
    ])('with the request on session %s, marks it current: %s', (currentSessionId, current) => {
      expect(mapper.toSessionResponse(makeSession(), currentSessionId).current).toBe(current);
    });

    it('never exposes the session token', () => {
      // The controller hands over the repository's `OwnedSession`, token included.
      const owned = { ...makeSession(), token: 'secret-token' };
      const dto = mapper.toSessionResponse(owned, null);

      expect(Object.keys(dto)).not.toContain('token');
    });
  });
});
