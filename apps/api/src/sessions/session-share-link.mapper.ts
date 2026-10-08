import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { CredentialOwner } from '../auth/domain/scope-context.types';
import { SessionShareLinkOrmEntity } from './database/session-share-link.orm-entity';
import { SessionShareLinkEntity } from './domain/session-share-link.entity';
import type { WorkSessionEntity } from './domain/work-session.entity';
import {
  SharedSessionResponseDto,
  ShareLinkResponseDto,
} from './dtos/session-share-link.response.dto';

/**
 * A share link between its domain, persistence and response shapes.
 * `toResponse` has no way to emit the secret: only the create handler ever
 * holds one, and its controller attaches it to that one response.
 */
@Injectable()
export class SessionShareLinkMapper
  implements Mapper<SessionShareLinkEntity, SessionShareLinkOrmEntity, ShareLinkResponseDto>
{
  toPersistence(entity: SessionShareLinkEntity): SessionShareLinkOrmEntity {
    const record = new SessionShareLinkOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.sessionId = entity.sessionId;
    record.createdByUserId = entity.createdByUserId;
    record.tokenHash = entity.tokenHash;
    record.access = entity.access;
    record.audience = entity.audience;
    record.people = entity.people;
    record.label = entity.label;
    record.expiresAt = entity.expiresAt;
    record.revokedAt = entity.revokedAt;
    return record;
  }

  toDomain(record: SessionShareLinkOrmEntity): SessionShareLinkEntity {
    return SessionShareLinkEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        sessionId: record.sessionId,
        createdByUserId: record.createdByUserId,
        tokenHash: record.tokenHash,
        access: record.access,
        audience: record.audience,
        people: record.people ?? [],
        label: record.label,
        expiresAt: record.expiresAt,
        revokedAt: record.revokedAt,
      },
    });
  }

  toResponse(entity: SessionShareLinkEntity, now: Date = new Date()): ShareLinkResponseDto {
    const dto = new ShareLinkResponseDto();
    dto.id = entity.id;
    dto.sessionId = entity.sessionId;
    dto.access = entity.access;
    dto.audience = entity.audience;
    dto.people = entity.people;
    dto.label = entity.label;
    dto.expiresAt = entity.expiresAt;
    dto.revokedAt = entity.revokedAt;
    dto.live = entity.isLive(now);
    dto.createdAt = entity.createdAt;
    return dto;
  }

  /** What a link's holder may know: no workspace, project, host or repository. */
  toSharedSession(
    link: SessionShareLinkEntity,
    session: WorkSessionEntity,
    owner: CredentialOwner | null,
  ): SharedSessionResponseDto {
    const dto = new SharedSessionResponseDto();
    dto.name = session.name;
    dto.state = session.stoppedAt !== null ? 'stopped' : 'live';
    dto.access = link.access;
    dto.sharedBy = owner ? `${owner.firstName} ${owner.lastName}`.trim() || null : null;
    dto.expiresAt = link.expiresAt;
    return dto;
  }
}
