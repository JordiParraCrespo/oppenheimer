import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { SessionCheckoutOrmEntity } from './database/session-checkout.orm-entity';
import { WorkSessionOrmEntity } from './database/work-session.orm-entity';
import { WorkSessionEventOrmEntity } from './database/work-session-event.orm-entity';
import { SessionCheckoutEntity } from './domain/session-checkout.entity';
import type { SessionAgent } from './domain/session-state.policy';
import { WorkSessionEntity } from './domain/work-session.entity';
import { WorkSessionEventEntity } from './domain/work-session-event.entity';
import { SessionCheckoutResponseDto, SessionResponseDto } from './dtos/session.response.dto';
import { SessionEventResponseDto } from './dtos/session-event.response.dto';

/**
 * Maps the work-session aggregate between its domain, persistence and response
 * shapes — the session, its checkouts and its log entries, because all three are
 * one aggregate and one mapper is what stops three files disagreeing about how a
 * bigint crosses a boundary.
 *
 * `githubRepoId` travels everywhere as the string the driver exchanges a bigint
 * as. Nothing coerces it: GitHub's ids fit in a JavaScript number today and the
 * column says they are not promised to.
 *
 * `state` on the wire is the **derived group**, not the stored lifecycle. That is
 * the committed client contract: the sidebar shows what needs you, and the mapping
 * from the runner's five observations lives in the fold rather than in the client.
 */
@Injectable()
export class WorkSessionMapper
  implements Mapper<WorkSessionEntity, WorkSessionOrmEntity, SessionResponseDto>
{
  toPersistence(entity: WorkSessionEntity): WorkSessionOrmEntity {
    const record = new WorkSessionOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.projectId = entity.projectId;
    record.createdByUserId = entity.createdByUserId;
    record.hostId = entity.hostId;
    record.name = entity.name;
    record.nameSource = entity.nameSource;
    record.slug = entity.slug;
    record.agent = entity.agent;
    record.cwdCheckoutId = entity.cwdCheckoutId;
    record.idempotencyKey = entity.idempotencyKey;
    record.state = entity.state;
    record.stateSeq = entity.stateSeq;
    record.agentSessionId = entity.agentSessionId;
    record.lastEventAt = entity.lastEventAt;
    record.stoppedAt = entity.stoppedAt;
    return record;
  }

  toDomain(
    record: WorkSessionOrmEntity,
    checkouts: SessionCheckoutOrmEntity[] = [],
  ): WorkSessionEntity {
    const session = WorkSessionEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        projectId: record.projectId,
        createdByUserId: record.createdByUserId,
        hostId: record.hostId,
        name: record.name,
        nameSource: record.nameSource,
        slug: record.slug,
        agent: record.agent as SessionAgent,
        cwdCheckoutId: record.cwdCheckoutId,
        idempotencyKey: record.idempotencyKey,
        state: record.state,
        stateSeq: record.stateSeq,
        agentSessionId: record.agentSessionId,
        lastEventAt: record.lastEventAt,
        stoppedAt: record.stoppedAt,
        checkouts: [],
      },
    });
    for (const checkout of checkouts) session.attachCheckout(this.checkoutToDomain(checkout));
    return session;
  }

  checkoutToPersistence(entity: SessionCheckoutEntity): SessionCheckoutOrmEntity {
    const record = new SessionCheckoutOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.sessionId = entity.sessionId;
    record.installationId = entity.installationId;
    record.githubRepoId = entity.githubRepoId;
    record.repositoryFullName = entity.repositoryFullName;
    record.storeDirectoryName = entity.storeDirectoryName;
    record.directoryName = entity.directoryName;
    record.mode = entity.mode;
    record.baseBranch = entity.baseBranch;
    record.branch = entity.branch;
    record.worktreeCreatedAt = entity.worktreeCreatedAt;
    record.pushedAt = entity.pushedAt;
    record.removedAt = entity.removedAt;
    return record;
  }

  checkoutToDomain(record: SessionCheckoutOrmEntity): SessionCheckoutEntity {
    return SessionCheckoutEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.createdAt,
      props: {
        organizationId: record.organizationId,
        sessionId: record.sessionId,
        installationId: record.installationId,
        githubRepoId: record.githubRepoId,
        repositoryFullName: record.repositoryFullName,
        storeDirectoryName: record.storeDirectoryName,
        directoryName: record.directoryName,
        mode: record.mode,
        baseBranch: record.baseBranch,
        branch: record.branch,
        worktreeCreatedAt: record.worktreeCreatedAt,
        pushedAt: record.pushedAt,
        removedAt: record.removedAt,
      },
    });
  }

  eventToPersistence(entity: WorkSessionEventEntity): WorkSessionEventOrmEntity {
    const record = new WorkSessionEventOrmEntity();
    record.id = entity.id;
    record.sessionId = entity.sessionId;
    record.seq = entity.seq;
    record.idempotencyKey = entity.idempotencyKey;
    record.source = entity.source;
    record.kind = entity.kind;
    record.payload = entity.payload;
    record.occurredAt = entity.occurredAt;
    record.recordedAt = entity.recordedAt;
    return record;
  }

  eventToDomain(record: WorkSessionEventOrmEntity): WorkSessionEventEntity {
    return WorkSessionEventEntity.create({
      id: record.id,
      createdAt: record.recordedAt,
      updatedAt: record.recordedAt,
      props: {
        sessionId: record.sessionId,
        seq: record.seq,
        idempotencyKey: record.idempotencyKey,
        source: record.source,
        kind: record.kind,
        payload: record.payload,
        occurredAt: record.occurredAt,
        recordedAt: record.recordedAt,
      },
    });
  }

  toResponse(entity: WorkSessionEntity, now: Date = new Date()): SessionResponseDto {
    const dto = new SessionResponseDto();
    dto.id = entity.id;
    dto.organizationId = entity.organizationId;
    dto.projectId = entity.projectId;
    dto.hostId = entity.hostId;
    dto.name = entity.name;
    dto.slug = entity.slug;
    dto.agent = entity.agent;
    dto.state = entity.group(now);
    dto.lifecycle = entity.state;
    dto.cwdCheckoutId = entity.cwdCheckoutId;
    dto.agentSessionId = entity.agentSessionId;
    dto.lastEventAt = entity.lastEventAt;
    dto.stoppedAt = entity.stoppedAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    // Retired checkouts are left out: the console renders what is on disk, and the
    // row survives only so its directory name is never reissued.
    dto.checkouts = entity.liveCheckouts.map((checkout) => this.checkoutToResponse(checkout));
    return dto;
  }

  checkoutToResponse(entity: SessionCheckoutEntity): SessionCheckoutResponseDto {
    const dto = new SessionCheckoutResponseDto();
    dto.id = entity.id;
    dto.installationId = entity.installationId;
    dto.githubRepoId = entity.githubRepoId;
    dto.repositoryFullName = entity.repositoryFullName;
    dto.directoryName = entity.directoryName;
    dto.storeDirectoryName = entity.storeDirectoryName;
    dto.mode = entity.mode;
    dto.baseBranch = entity.baseBranch;
    dto.branch = entity.branch;
    return dto;
  }

  eventToResponse(entity: WorkSessionEventEntity): SessionEventResponseDto {
    const dto = new SessionEventResponseDto();
    dto.id = entity.id;
    dto.sessionId = entity.sessionId;
    dto.seq = entity.seq;
    dto.source = entity.source;
    dto.kind = entity.kind;
    dto.payload = entity.payload;
    dto.occurredAt = entity.occurredAt;
    dto.recordedAt = entity.recordedAt;
    return dto;
  }
}
