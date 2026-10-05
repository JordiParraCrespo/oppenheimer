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
  it('maps a session row with defaults, and never carries its token', () => {
    // The gateway hands over raw session rows, token included.
    const result = AdminUserMapper.toSessionResponse({
      id: 's1',
      userId: 'u1',
      token: 'token-1',
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

describe('AdminUserMapper.toSuccess', () => {
  it.each([
    [{ success: true }, true],
    [{ success: false }, false],
    [{ status: true }, true],
    [{}, false],
  ])('reads %j as success: %s', (input, success) => {
    expect(AdminUserMapper.toSuccess(input)).toEqual({ success });
  });
});
