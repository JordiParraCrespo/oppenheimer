import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { CredentialOwner } from '../auth/domain/scope-context.types';
import { SessionShareOrmEntity } from './database/session-share.orm-entity';
import { SessionShareEntity } from './domain/session-share.entity';
import type { WorkSessionEntity } from './domain/work-session.entity';
import {
  SessionShareResponseDto,
  SharedSessionResponseDto,
} from './dtos/session-share.response.dto';

function nameOf(owner: CredentialOwner): string {
  return `${owner.firstName} ${owner.lastName}`.trim() || owner.email;
}

/** A session's share between its domain, persistence and response shapes. */
@Injectable()
export class SessionShareMapper
  implements Mapper<SessionShareEntity, SessionShareOrmEntity, SessionShareResponseDto>
{
  toPersistence(entity: SessionShareEntity): SessionShareOrmEntity {
    const record = new SessionShareOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.sessionId = entity.sessionId;
    record.sharedByUserId = entity.sharedByUserId;
    record.slug = entity.slug;
    record.audience = entity.audience;
    record.access = entity.access;
    record.people = entity.people;
    record.expiresAt = entity.expiresAt;
    return record;
  }

  toDomain(record: SessionShareOrmEntity): SessionShareEntity {
    return SessionShareEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        sessionId: record.sessionId,
        sharedByUserId: record.sharedByUserId,
        slug: record.slug,
        audience: record.audience,
        access: record.access,
        people: record.people ?? [],
        expiresAt: record.expiresAt,
      },
    });
  }

  toResponse(
    entity: SessionShareEntity,
    owner: CredentialOwner | null = null,
  ): SessionShareResponseDto {
    const dto = new SessionShareResponseDto();
    dto.id = entity.id;
    dto.sessionId = entity.sessionId;
    dto.slug = entity.slug;
    dto.audience = entity.audience;
    dto.access = entity.access;
    dto.people = entity.people;
    dto.expiresAt = entity.expiresAt;
    dto.sharedBy = owner ? { id: owner.id, name: nameOf(owner), email: owner.email } : null;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }

  /** What a guest may know: no workspace, project, host or repository. */
  toSharedSession(
    share: SessionShareEntity,
    session: WorkSessionEntity,
    owner: CredentialOwner | null,
  ): SharedSessionResponseDto {
    const dto = new SharedSessionResponseDto();
    dto.name = session.name;
    dto.state = session.stoppedAt !== null ? 'stopped' : 'live';
    dto.access = share.access;
    dto.sharedBy = owner ? nameOf(owner) : null;
    dto.expiresAt = share.expiresAt;
    return dto;
  }
}
