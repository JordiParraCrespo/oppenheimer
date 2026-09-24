import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { CreateSessionDto } from '@oppenheimer/shared';
import { SessionCheckoutOrmEntity } from './database/session-checkout.orm-entity';
import { WorkSessionOrmEntity } from './database/work-session.orm-entity';
import type { NewSessionEvent } from './database/work-session.repository.port';
import { WorkSessionEventOrmEntity } from './database/work-session-event.orm-entity';
import { SessionCheckoutEntity } from './domain/session-checkout.entity';
import {
  launchPermissionFor,
  SESSION_EVENT_KINDS,
  type SessionAgent,
  type SessionFold,
  type SessionLaunchFold,
} from './domain/session-state.policy';
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
 * the committed client contract: the sidebar shows what needs you. It is computed
 * from the row and nothing else — every input the group reads is a column the fold
 * projects — so a listing answers it without walking a log, and a mapper cannot be
 * handed an observation the log never recorded.
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
    record.idempotencyKey = entity.idempotencyKey;
    const fold = entity.fold;
    record.state = fold.state;
    record.stateSeq = fold.stateSeq;
    record.agentSessionId = fold.agentSessionId;
    record.lastEventAt = fold.lastEventAt;
    record.stoppedAt = fold.stoppedAt;
    record.cwdCheckoutId = fold.cwdCheckoutId;
    record.lastObservedState = fold.lastObservedState;
    record.observedSince = fold.observedSince;
    record.reportHash = fold.reportHash;
    record.ackedReportHash = fold.ackedReportHash;
    record.launchModel = fold.launch.model;
    record.launchPermission = fold.launch.permission;
    record.launchEffort = fold.launch.effort;
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
        slug: record.slug,
        agent: record.agent as SessionAgent,
        idempotencyKey: record.idempotencyKey,
        checkouts: [],
        ...this.foldOf(record),
      },
    });
    for (const checkout of checkouts) session.attachCheckout(this.checkoutToDomain(checkout));
    return session;
  }

  /**
   * The projection as a value. It is read back whole rather than column by column
   * because the repository re-seats an aggregate on it inside the row lock, and a
   * field missing there would be a column the fold silently stops maintaining.
   */
  foldOf(record: WorkSessionOrmEntity): SessionFold {
    return {
      state: record.state,
      stateSeq: record.stateSeq,
      agentSessionId: record.agentSessionId,
      lastEventAt: record.lastEventAt,
      stoppedAt: record.stoppedAt,
      name: record.name,
      nameSource: record.nameSource,
      cwdCheckoutId: record.cwdCheckoutId,
      lastObservedState: record.lastObservedState,
      observedSince: record.observedSince,
      reportHash: record.reportHash,
      ackedReportHash: record.ackedReportHash,
      launch: {
        model: record.launchModel,
        // Null is a session whose agent has no approvals; for any other agent
        // a missing level reads as the one that asks before every action.
        permission: launchPermissionFor(record.agent, record.launchPermission),
        effort: record.launchEffort,
      },
    };
  }

  /**
   * The entries a create request owes its log — one action, one transaction.
   *
   * It is a mapper method rather than an object literal in the handler for the
   * reason every shape in this file is: these three entries *are* the session's
   * columns, since the fold projects them, and assembling them beside the
   * persistence shape they produce is what keeps the two saying the same thing.
   *
   * There are three, at most. `session.requested` states the launch, because the
   * launch columns are a projection of it. `session.cwd_set` says where the agent
   * runs, as an entry rather than a column write because a later "work in this
   * checkout instead" is the same entry. `prompt.first` carries the composer's
   * task when there was one — and never appears at all when there was not, rather
   * than appearing empty.
   */
  toRequestEvents(props: {
    commandId: string;
    userId: string;
    input: CreateSessionDto;
    checkouts: number;
    cwdCheckoutId: string | null;
  }): NewSessionEvent[] {
    const { input } = props;
    const key = (kind: string) => WorkSessionEntity.apiIdempotencyKey(props.commandId, kind);
    const events: NewSessionEvent[] = [
      {
        idempotencyKey: key(SESSION_EVENT_KINDS.REQUESTED),
        source: 'api',
        kind: SESSION_EVENT_KINDS.REQUESTED,
        payload: {
          agent: input.agent,
          hostId: input.hostId,
          checkouts: props.checkouts,
          requestedByUserId: props.userId,
          launch: this.toLaunch(input.agent, input.launch),
        },
      },
      {
        idempotencyKey: key(SESSION_EVENT_KINDS.CWD_SET),
        source: 'api',
        kind: SESSION_EVENT_KINDS.CWD_SET,
        payload: { checkoutId: props.cwdCheckoutId },
      },
    ];
    if (input.prompt) {
      events.push({
        idempotencyKey: WorkSessionMapper.promptKeyFor(props.commandId),
        source: 'api',
        kind: SESSION_EVENT_KINDS.PROMPT_FIRST,
        payload: { text: input.prompt },
      });
    }
    return events;
  }

  /**
   * The launch a request states, with the absences filled in.
   *
   * An absent level is `ask` — the one that asks before every action — and never
   * anything else: a default that escalated is the single mistake this field must
   * not make (`product/versions/mvp/03-control-plane.md`). An agent with no
   * approvals records no level at all (`launchPermissionFor`).
   */
  toLaunch(
    agent: CreateSessionDto['agent'],
    launch: CreateSessionDto['launch'],
  ): SessionLaunchFold {
    return {
      model: launch?.model ?? null,
      permission: launchPermissionFor(agent, launch?.permission),
      effort: launch?.effort ?? null,
    };
  }

  /**
   * What keys the `prompt.first` entry of a create request — and therefore the
   * name derived from it, so the title is keyed on the prompt that caused it.
   */
  static promptKeyFor(commandId: string): string {
    return WorkSessionEntity.apiIdempotencyKey(commandId, SESSION_EVENT_KINDS.PROMPT_FIRST);
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

  /**
   * `hints` is what the control plane could not do for *this request* — it is
   * empty on every read and carries `host_offline` when a command could not reach
   * the host. It rides the session rather than a second envelope because the
   * console renders the row it just changed.
   */
  toResponse(
    entity: WorkSessionEntity,
    options: { now?: Date; hints?: string[] } = {},
  ): SessionResponseDto {
    const now = options.now ?? new Date();
    const dto = new SessionResponseDto();
    dto.id = entity.id;
    dto.organizationId = entity.organizationId;
    dto.projectId = entity.projectId;
    dto.hostId = entity.hostId;
    dto.name = entity.name;
    dto.slug = entity.slug;
    dto.agent = entity.agent;
    dto.launch = {
      model: entity.launch.model,
      permission: entity.launch.permission,
      effort: entity.launch.effort,
    };
    dto.state = entity.group(now);
    dto.lifecycle = entity.state;
    dto.cwdCheckoutId = entity.cwdCheckoutId;
    dto.agentSessionId = entity.agentSessionId;
    dto.lastEventAt = entity.lastEventAt;
    dto.stoppedAt = entity.stoppedAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.hints = options.hints ?? [];
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
