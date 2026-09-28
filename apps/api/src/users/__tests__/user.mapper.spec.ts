import { describe, expect, it } from 'vitest';
import { UserOrmEntity } from '../database/user.orm-entity';
import { UserEntity } from '../domain/user.entity';
import { Email } from '../domain/value-objects/email.value-object';
import { UserMapper } from '../user.mapper';

function makeUser(
  firstName: string,
  lastName: string,
  ban: { banned: boolean; banExpires: Date | null } = { banned: false, banExpires: null },
): UserEntity {
  return UserEntity.create({
    id: 'user-uuid',
    props: {
      email: new Email({ value: 'adri@example.com' }),
      firstName,
      lastName,
      phone: null,
      jobTitle: null,
      username: null,
      avatarUrl: 'avatars/user-uuid.png',
      role: 'user',
      isActive: true,
      emailVerified: true,
      ...ban,
    },
  });
}

describe('UserMapper.toPersistence', () => {
  const mapper = new UserMapper();

  it('derives the Better Auth display name from the first and last name', () => {
    // Member lists and invitation emails read `user.name`; a profile update
    // that saved only firstName/lastName kept the old name on every one of them.
    const record = mapper.toPersistence(makeUser('Adrián', 'Rodrigo'));

    expect(record.name).toBe('Adrián Rodrigo');
  });

  it('trims surrounding whitespace out of the derived name', () => {
    expect(mapper.toPersistence(makeUser(' Adri ', ' Rodrigo ')).name).toBe('Adri   Rodrigo');
  });

  it('round-trips the avatar key through `image`', () => {
    expect(mapper.toPersistence(makeUser('A', 'B')).image).toBe('avatars/user-uuid.png');
  });

  it('never writes the ban columns, which the admin plugin owns', () => {
    // A profile save racing a ban would otherwise write the stale
    // `banned = false` back over it.
    const record = mapper.toPersistence(
      makeUser('A', 'B', { banned: true, banExpires: new Date('2030-01-01T00:00:00.000Z') }),
    );

    expect(record.banned).toBeUndefined();
    expect(record.banReason).toBeUndefined();
    expect(record.banExpires).toBeUndefined();
  });
});

describe('UserMapper.toDomain', () => {
  const mapper = new UserMapper();

  function recordWith(overrides: Partial<UserOrmEntity>): UserOrmEntity {
    return Object.assign(new UserOrmEntity(), {
      id: 'user-uuid',
      email: 'adri@example.com',
      firstName: 'Adri',
      lastName: 'Rodrigo',
      phone: null,
      jobTitle: null,
      username: null,
      image: null,
      role: 'user',
      isActive: true,
      emailVerified: true,
      banned: false,
      banReason: null,
      banExpires: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    });
  }

  it('carries the ban onto the aggregate', () => {
    const banExpires = new Date('2030-01-01T00:00:00.000Z');
    const user = mapper.toDomain(recordWith({ banned: true, banExpires }));

    expect(user.banned).toBe(true);
    expect(user.banExpires).toEqual(banExpires);
  });

  it('reads a record with the ban columns unset as not banned', () => {
    // The record `save` hands back is the one `toPersistence` wrote.
    const record = recordWith({});
    Reflect.deleteProperty(record, 'banned');
    Reflect.deleteProperty(record, 'banExpires');

    const user = mapper.toDomain(record);

    expect(user.banned).toBe(false);
    expect(user.banExpires).toBeNull();
  });
});
