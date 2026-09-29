import { describe, expect, it } from 'vitest';
import { AdminUserMapper } from '../admin-user.mapper';

describe('AdminUserMapper.toResponse', () => {
  it('maps a full Better Auth user record', () => {
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    const banExpires = new Date('2024-02-01T00:00:00.000Z');

    const result = AdminUserMapper.toResponse({
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
    const result = AdminUserMapper.toResponse({
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
    const result = AdminUserMapper.toResponse({
      id: 'u1',
      email: 'a@b.com',
      createdAt: '2024-03-15T10:00:00.000Z',
      banExpires: '2024-04-15T10:00:00.000Z',
    });

    expect(result.createdAt.toISOString()).toBe('2024-03-15T10:00:00.000Z');
    expect(result.banExpires?.toISOString()).toBe('2024-04-15T10:00:00.000Z');
  });

  it('returns a defensive shape for a completely empty input', () => {
    const result = AdminUserMapper.toResponse({});
    expect(result.id).toBe('undefined');
    expect(result.email).toBe('undefined');
    expect(result.role).toBeNull();
  });
});

describe('AdminUserMapper.fromEnvelope', () => {
  it('unwraps a `{ user }` envelope', () => {
    const result = AdminUserMapper.fromEnvelope({
      user: {
        id: 'u1',
        email: 'a@b.com',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    });
    expect(result.id).toBe('u1');
  });

  it('maps a bare user object when there is no envelope', () => {
    const result = AdminUserMapper.fromEnvelope({
      id: 'u2',
      email: 'c@d.com',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(result.id).toBe('u2');
  });
});

describe('AdminUserMapper.toListResponse', () => {
  it('maps the paginated user list envelope', () => {
    const result = AdminUserMapper.toListResponse({
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
    const result = AdminUserMapper.toListResponse({});
    expect(result.users).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.limit).toBeNull();
    expect(result.offset).toBeNull();
  });
});

describe('AdminUserMapper.toSessionResponse', () => {
  it('maps a session record with defaults', () => {
    const result = AdminUserMapper.toSessionResponse({
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

describe('AdminUserMapper.toSessionsResponse', () => {
  it('unwraps a `{ sessions }` envelope', () => {
    const result = AdminUserMapper.toSessionsResponse({
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
    expect(AdminUserMapper.toSessionsResponse({})).toEqual([]);
  });
});

describe('AdminUserMapper.toSuccess', () => {
  it('reads the `success` flag', () => {
    expect(AdminUserMapper.toSuccess({ success: true })).toEqual({ success: true });
    expect(AdminUserMapper.toSuccess({ success: false })).toEqual({ success: false });
  });

  it('falls back to the `status` flag', () => {
    expect(AdminUserMapper.toSuccess({ status: true })).toEqual({ success: true });
  });

  it('is false when neither flag is present', () => {
    expect(AdminUserMapper.toSuccess({})).toEqual({ success: false });
  });
});
