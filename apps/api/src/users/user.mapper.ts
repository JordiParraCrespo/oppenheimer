import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { CredentialOwner } from '../auth/domain/scope-context.types';
import { UserOrmEntity } from './database/user.orm-entity';
import { UserEntity } from './domain/user.entity';
import { Email } from './domain/value-objects/email.value-object';
import { Username } from './domain/value-objects/username.value-object';
import { UserResponseDto } from './dtos/user.response.dto';

/**
 * `toPersistence` writes only the profile columns the application owns. `name`, Better
 * Auth's display name, is derived from the first and last name, so the member list and
 * the invitation email never show a stale one. `image` round-trips, so an update that
 * does not mention the avatar (including one a social provider supplied) leaves it as
 * it was. The admin
 * plugin's ban columns are read, never written: a profile save racing a ban would
 * write a stale `banned = false` back over it.
 */
@Injectable()
export class UserMapper implements Mapper<UserEntity, UserOrmEntity, UserResponseDto> {
  toPersistence(entity: UserEntity): UserOrmEntity {
    const record = new UserOrmEntity();
    record.id = entity.id;
    record.email = entity.email;
    record.firstName = entity.firstName;
    record.lastName = entity.lastName;
    record.name = displayNameOf(entity);
    record.phone = entity.phone;
    record.jobTitle = entity.jobTitle;
    record.username = entity.username;
    record.image = entity.avatarUrl;
    record.role = entity.role;
    record.isActive = entity.isActive;
    record.emailVerified = entity.emailVerified;
    return record;
  }

  toDomain(record: UserOrmEntity): UserEntity {
    return UserEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        email: new Email({ value: record.email }),
        firstName: record.firstName,
        lastName: record.lastName,
        phone: record.phone,
        jobTitle: record.jobTitle,
        username: record.username === null ? null : Username.from(record.username),
        avatarUrl: record.image,
        role: record.role,
        isActive: record.isActive,
        emailVerified: record.emailVerified,
        // Defaulted: the record `save` hands back is the one `toPersistence`
        // built, which leaves the ban columns unset.
        banned: record.banned ?? false,
        banExpires: record.banExpires ?? null,
      },
    });
  }

  /**
   * The shape the auth kernel puts on `request.user` for a scoped credential.
   * It is the live account, not a copy taken when the credential was issued,
   * so the roles the policies guard reads are always current.
   */
  toCredentialOwner(entity: UserEntity): CredentialOwner {
    return {
      id: entity.id,
      email: entity.email,
      firstName: entity.firstName,
      lastName: entity.lastName,
      role: entity.role,
      isActive: entity.isActive,
      emailVerified: entity.emailVerified,
    };
  }

  toResponse(entity: UserEntity): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = entity.id;
    dto.email = entity.email;
    dto.firstName = entity.firstName;
    dto.lastName = entity.lastName;
    dto.role = entity.role;
    dto.isActive = entity.isActive;
    dto.emailVerified = entity.emailVerified;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

/** The display name Better Auth (and every screen that reads `user.name`) shows. */
function displayNameOf(entity: UserEntity): string {
  return `${entity.firstName} ${entity.lastName}`.trim();
}
