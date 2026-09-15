import { describe, expect, it } from 'vitest';
import { UserEntity } from '../../users/domain/user.entity';
import { Email } from '../../users/domain/value-objects/email.value-object';
import { UserSettingsOrmEntity } from '../database/user-settings.orm-entity';
import { UserSettingsEntity } from '../domain/user-settings.entity';
import { ProfileMapper, type SessionRecord } from '../profile.mapper';

function makeUser(overrides: { phone?: string | null; avatarUrl?: string | null } = {}) {
  return UserEntity.create({
    id: 'user-uuid',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-02-01'),
    props: {
      email: new Email({ value: 'adri@example.com' }),
      firstName: 'Adri',
      lastName: 'Rodrigo',
      phone: overrides.phone ?? '+34 600 123 456',
      jobTitle: 'Founder',
      avatarUrl: overrides.avatarUrl ?? 'avatars/user-uuid.png',
      role: 'owner',
      isActive: true,
      emailVerified: true,
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

    it('passes a null avatar through', () => {
      expect(mapper.toProfileResponse(makeUser({ avatarUrl: null }), null).avatarUrl).toBeNull();
    });
  });

  describe('toSessionResponse', () => {
    it('marks the session the request was made with', () => {
      expect(mapper.toSessionResponse(makeSession(), 'session-1').current).toBe(true);
      expect(mapper.toSessionResponse(makeSession(), 'session-2').current).toBe(false);
    });

    it('marks nothing as current when the caller has no session id', () => {
      // The scoped-credential path has no device session — claiming one of the
      // user's real devices is "current" would offer the wrong affordance.
      expect(mapper.toSessionResponse(makeSession(), null).current).toBe(false);
    });

    it('never exposes the session token', () => {
      const dto = mapper.toSessionResponse(makeSession(), null);

      expect(Object.keys(dto)).not.toContain('token');
    });
  });
});
