import { describe, expect, it } from 'vitest';
import {
  mapSession,
  mapSessionsFromResult,
  mapSuccess,
  mapUser,
  mapUserFromResult,
  mapUserList,
} from '../admin.mappers';

describe('mapUser', () => {
  it('maps a full Better Auth user record', () => {
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    const banExpires = new Date('2024-02-01T00:00:00.000Z');

    const result = mapUser({
      id: 'u1',
      email: 'a@b.com',
      name: 'Alice',
      role: 'admin',
      emailVerified: true,
      banned: true,
      banReason: 'spam',
      banExpires,
      createdAt,
    });

    expect(result).toEqual({
      id: 'u1',
      email: 'a@b.com',
      name: 'Alice',
      role: 'admin',
      emailVerified: true,
      banned: true,
      banReason: 'spam',
      banExpires,
      createdAt,
    });
  });

  it('applies safe defaults for missing/nullish fields', () => {
    const result = mapUser({
      id: 1,
      email: 'x@y.com',
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    expect(result.id).toBe('1'); // coerced to string
    expect(result.name).toBe('');
    expect(result.role).toBeNull();
    expect(result.emailVerified).toBe(false);
    expect(result.banned).toBe(false);
    expect(result.banReason).toBeNull();
    expect(result.banExpires).toBeNull();
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('parses string dates into Date instances', () => {
    const result = mapUser({
      id: 'u1',
      email: 'a@b.com',
      createdAt: '2024-03-15T10:00:00.000Z',
      banExpires: '2024-04-15T10:00:00.000Z',
    });

    expect(result.createdAt.toISOString()).toBe('2024-03-15T10:00:00.000Z');
    expect(result.banExpires?.toISOString()).toBe('2024-04-15T10:00:00.000Z');
  });

  it('returns a defensive shape for a completely empty input', () => {
    const result = mapUser({});
    expect(result.id).toBe('undefined');
    expect(result.email).toBe('undefined');
    expect(result.role).toBeNull();
  });
});

describe('mapUserFromResult', () => {
  it('unwraps a `{ user }` envelope', () => {
    const result = mapUserFromResult({
      user: {
        id: 'u1',
        email: 'a@b.com',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    });
    expect(result.id).toBe('u1');
  });

  it('maps a bare user object when there is no envelope', () => {
    const result = mapUserFromResult({
      id: 'u2',
      email: 'c@d.com',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(result.id).toBe('u2');
  });
});

describe('mapUserList', () => {
  it('maps the paginated user list envelope', () => {
    const result = mapUserList({
      users: [
        { id: 'u1', email: 'a@b.com', createdAt: '2024-01-01T00:00:00.000Z' },
        { id: 'u2', email: 'c@d.com', createdAt: '2024-01-01T00:00:00.000Z' },
      ],
      total: 2,
      limit: 20,
      offset: 0,
    });

    expect(result.users).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('defaults total to 0 and limit/offset to null when absent', () => {
    const result = mapUserList({});
    expect(result.users).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.limit).toBeNull();
    expect(result.offset).toBeNull();
  });
});

describe('mapSession', () => {
  it('maps a session record with defaults', () => {
    const result = mapSession({
      id: 's1',
      userId: 'u1',
      expiresAt: '2024-01-01T00:00:00.000Z',
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    expect(result.id).toBe('s1');
    expect(result.userId).toBe('u1');
    expect(result).not.toHaveProperty('token');
    expect(result.ipAddress).toBeNull();
    expect(result.userAgent).toBeNull();
    expect(result.expiresAt).toBeInstanceOf(Date);
  });
});

describe('mapSessionsFromResult', () => {
  it('unwraps a `{ sessions }` envelope', () => {
    const result = mapSessionsFromResult({
      sessions: [
        {
          id: 's1',
          userId: 'u1',
          expiresAt: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
  });

  it('returns an empty array when there are no sessions', () => {
    expect(mapSessionsFromResult({})).toEqual([]);
  });
});

describe('mapSuccess', () => {
  it('reads the `success` flag', () => {
    expect(mapSuccess({ success: true })).toEqual({ success: true });
    expect(mapSuccess({ success: false })).toEqual({ success: false });
  });

  it('falls back to the `status` flag', () => {
    expect(mapSuccess({ status: true })).toEqual({ success: true });
  });

  it('is false when neither flag is present', () => {
    expect(mapSuccess({})).toEqual({ success: false });
  });
});
