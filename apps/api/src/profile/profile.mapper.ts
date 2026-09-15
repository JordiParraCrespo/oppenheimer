import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { UserEntity } from '../users/domain/user.entity';
import { UserSettingsOrmEntity } from './database/user-settings.orm-entity';
import { UserSettingsEntity } from './domain/user-settings.entity';
import { ProfileResponseDto } from './dtos/profile.response.dto';
import { UserSessionResponseDto } from './dtos/user-session.response.dto';
import { UserSettingsResponseDto } from './dtos/user-settings.response.dto';

/** The session columns this module reads. Better Auth owns the table. */
export interface SessionRecord {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

/**
 * Maps the settings aggregate between its domain, persistence and response
 * shapes, and shapes the two things the profile screen reads but does not own:
 * the user aggregate (owned by the users module) and Better Auth's sessions.
 *
 * `Mapper` is implemented for the settings aggregate — the one this module owns
 * — and the other two get their own methods, which is what the interface's
 * three methods leave room for (see ARCHITECTURE.md, "Mapper").
 */
@Injectable()
export class ProfileMapper
  implements Mapper<UserSettingsEntity, UserSettingsOrmEntity, UserSettingsResponseDto>
{
  toPersistence(entity: UserSettingsEntity): UserSettingsOrmEntity {
    const record = new UserSettingsOrmEntity();
    record.userId = entity.userId;
    record.theme = entity.theme;
    record.locale = entity.locale;
    record.density = entity.density;
    record.weeklyDigest = entity.weeklyDigest;
    record.productUpdates = entity.productUpdates;
    return record;
  }

  toDomain(record: UserSettingsOrmEntity): UserSettingsEntity {
    return UserSettingsEntity.create({
      id: record.userId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        theme: record.theme,
        locale: record.locale,
        density: record.density,
        weeklyDigest: record.weeklyDigest,
        productUpdates: record.productUpdates,
      },
    });
  }

  toResponse(entity: UserSettingsEntity): UserSettingsResponseDto {
    const dto = new UserSettingsResponseDto();
    dto.userId = entity.userId;
    dto.theme = entity.theme;
    dto.locale = entity.locale;
    dto.density = entity.density;
    dto.weeklyDigest = entity.weeklyDigest;
    dto.productUpdates = entity.productUpdates;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }

  /**
   * `avatarUrl` is passed in rather than read off the user: what is persisted
   * is a storage key, and turning it into a loadable URL needs the storage
   * back-end (and, on S3, a signature). Resolving it stays in `AvatarStorage`
   * so this mapper remains pure.
   */
  toProfileResponse(user: UserEntity, avatarUrl: string | null): ProfileResponseDto {
    const dto = new ProfileResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.firstName = user.firstName;
    dto.lastName = user.lastName;
    dto.phone = user.phone;
    dto.jobTitle = user.jobTitle;
    dto.avatarUrl = avatarUrl;
    dto.role = user.role;
    dto.emailVerified = user.emailVerified;
    // Hard-coded rather than read from anywhere: the Better Auth `twoFactor`
    // plugin is not enabled, so there is no enrolment to report. When it is,
    // this reads the user's enrolment instead and the field starts varying.
    dto.twoFactorEnabled = false;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }

  toSessionResponse(
    record: SessionRecord,
    currentSessionId: string | null,
  ): UserSessionResponseDto {
    const dto = new UserSessionResponseDto();
    dto.id = record.id;
    dto.ipAddress = record.ipAddress;
    dto.userAgent = record.userAgent;
    dto.current = record.id === currentSessionId;
    dto.createdAt = record.createdAt;
    dto.updatedAt = record.updatedAt;
    dto.expiresAt = record.expiresAt;
    return dto;
  }
}
