import { describe, expect, it } from 'vitest';
import { UserEntity } from '../domain/user.entity';
import { Email } from '../domain/value-objects/email.value-object';
import { UserMapper } from '../user.mapper';

function makeUser(firstName: string, lastName: string): UserEntity {
  return UserEntity.create({
    id: 'user-uuid',
    props: {
      email: new Email({ value: 'adri@example.com' }),
      firstName,
      lastName,
      phone: null,
      jobTitle: null,
      avatarUrl: 'avatars/user-uuid.png',
      role: 'user',
      isActive: true,
      emailVerified: true,
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
});
