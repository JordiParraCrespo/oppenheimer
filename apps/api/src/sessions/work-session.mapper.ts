import { posix } from 'node:path';
import { Injectable } from '@nestjs/common';
import { toPageMeta } from '@oppenheimer/backend-core';
import type { Mapper } from '@oppenheimer/backend-ddd';
import {
  type SessionAttachmentDto,
  type SessionDecision,
  type StartCloudSessionDto,
  sessionDecisionSchema,
} from '@oppenheimer/shared';
import type { SessionFileMediaType } from '@oppenheimer/shared/protocol';
import type { CloudAgentLaunch } from '../cloud-agents/application/cloud-runs.port';
import type { HostFolderListing } from './application/host-folders.port';
import { SessionCheckoutOrmEntity } from './database/session-checkout.orm-entity';
import { SessionCloudRunOrmEntity } from './database/session-cloud-run.orm-entity';
import { SessionTurnOrmEntity } from './database/session-turn.orm-entity';
import type { SessionUsageWeek } from './database/session-usage.repository.port';
import { WorkSessionOrmEntity } from './database/work-session.orm-entity';
import type {
  NewSessionEvent,
  RecentFolder,
  SessionListPage,
} from './database/work-session.repository.port';
import { WorkSessionEventOrmEntity } from './database/work-session-event.orm-entity';
import type { CloudTaskFile } from './domain/cloud-task.policy';
import { SessionCheckoutEntity } from './domain/session-checkout.entity';
import { type CloudRunReport, SessionCloudRunEntity } from './domain/session-cloud-run.entity';
import { encodeSessionListCursor } from './domain/session-list-cursor.policy';
import {
  launchPermissionFor,
  type SessionAgent,
  type SessionFold,
} from './domain/session-state.policy';
import {
  SESSION_ORIGINS,
  type SessionTurnFold,
  TURN_DRIVES,
  TURN_ORIGINS,
  TURN_STATES,
  type TurnDrive,
  type TurnOrigin,
  type TurnState,
} from './domain/session-turn.policy';
import { WorkSessionEntity } from './domain/work-session.entity';
import { WorkSessionEventEntity } from './domain/work-session-event.entity';
import { HostFoldersResponseDto } from './dtos/host-folders.response.dto';
import {
  SessionCheckoutResponseDto,
  SessionCloudRunResponseDto,
  SessionPageMetaDto,
  SessionResponseDto,
} from './dtos/session.response.dto';
import type { SessionDecisionResponseDto } from './dtos/session-decision.response.dto';
import { SessionEventResponseDto } from './dtos/session-event.response.dto';

/**
 * One row the batched append's `INSERT … RETURNING` answers, beside the count of
 * rows it meant to insert. `id` is null on the single row that comes back when
 * nothing landed at all.
 */
export interface AppendedEventRow {
  expected: number;
  id: string | null;
  seq: number;
  idempotencyKey: string;
  source: WorkSessionEventOrmEntity['source'];
  kind: string;
  payload: unknown;
  occurredAt: Date;
  recordedAt: Date;
}

/**
 * One mapper for the whole aggregate (session, checkouts, log entries), so three
 * files cannot disagree about how a bigint crosses a boundary.
 *
 * `githubRepoId` travels everywhere as the string the driver exchanges a bigint as,
 * never coerced: GitHub's ids fit in a number today and the column says they are not
 * promised to.
 *
 * `state` on the wire is the **derived group**, not the stored lifecycle: the
 * committed client contract (the sidebar shows what needs you). It is computed from
 * the row alone, every input being a column the fold projects, so a listing needs no
 * log walk and a mapper cannot be handed an observation the log never recorded.
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
    record.place = entity.place;
    record.folderPath = entity.folderPath;
    record.idempotencyKey = entity.idempotencyKey;
    record.origin = entity.origin;
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
    record.closeRequestedAt = fold.closeRequest?.requestedAt ?? null;
    record.closeAcceptsUnpushedWork = fold.closeRequest?.acceptUnpushedWork ?? false;
    record.closeRefusalCode = fold.closeRefusal?.code ?? null;
    record.closeRefusalDetail = fold.closeRefusal?.detail ?? null;
    record.pendingDecision = fold.pendingDecision;
    return record;
  }

  toDomain(
    record: WorkSessionOrmEntity,
    checkouts: SessionCheckoutOrmEntity[] = [],
    cloudRun: SessionCloudRunOrmEntity | null = null,
  ): WorkSessionEntity {
    const session = WorkSessionEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        createdByUserId: record.createdByUserId,
        hostId: record.hostId,
        slug: record.slug,
        agent: record.agent as SessionAgent,
        // The row's CHECKs hold the place and the folder to each other.
        place: record.place,
        folderPath: record.folderPath,
        idempotencyKey: record.idempotencyKey,
        checkouts: [],
        cloudRun: cloudRun ? this.cloudRunToDomain(cloudRun) : null,
        origin: (SESSION_ORIGINS as readonly string[]).includes(record.origin)
          ? record.origin
          : 'person',
        // Loaded by the repository when it folds, under the row lock.
        latestTurn: null,
        ...this.foldOf(record),
        // After the fold: on a row the listed project is never null.
        projectId: record.projectId,
      },
    });
    for (const checkout of checkouts) session.attachCheckout(this.checkoutToDomain(checkout));
    return session;
  }

  /**
   * The stored decision, read back through its schema: a `jsonb` value is only as
   * typed as whatever wrote it, and one this build cannot read is no decision.
   */
  decisionOf(value: unknown): SessionDecision | null {
    if (value === null || value === undefined) return null;
    const parsed = sessionDecisionSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  /** One row of the recent-folders aggregate; the driver returns the `max` as a `Date`. */
  recentFolderOf(row: unknown): RecentFolder {
    const record = typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : {};
    const at = record.lastUsedAt;
    return {
      path: String(record.path),
      lastUsedAt: at instanceof Date ? at : new Date(String(at)),
    };
  }

  /**
   * The folder picker's answer: the runner's listing with each entry's path
   * joined on the host's own separator, and the caller's recent folders. Absent
   * branches and an absent `truncated` are spelled out, so a client never has to
   * tell "no" from "not said".
   */
  toFoldersResponse(listing: HostFolderListing, recent: RecentFolder[]): HostFoldersResponseDto {
    const dto = new HostFoldersResponseDto();
    dto.path = listing.path;
    dto.parent = listing.parent;
    dto.home = listing.home;
    dto.branch = listing.branch ?? null;
    dto.entries = listing.entries.map((entry) => ({
      name: entry.name,
      path: posix.join(listing.path, entry.name),
      branch: entry.branch ?? null,
    }));
    dto.truncated = listing.truncated ?? false;
    dto.recent = recent.map((folder) => ({ path: folder.path, lastUsedAt: folder.lastUsedAt }));
    return dto;
  }

  /** A stored turn as the fold reads it. Values outside the unions read as their safest member. */
  turnToDomain(record: SessionTurnOrmEntity): SessionTurnFold {
    return {
      seq: record.seq,
      origin: (TURN_ORIGINS as readonly string[]).includes(record.origin)
        ? (record.origin as TurnOrigin)
        : 'person',
      drive: (TURN_DRIVES as readonly string[]).includes(record.drive)
        ? (record.drive as TurnDrive)
        : 'interactive',
      state: (TURN_STATES as readonly string[]).includes(record.state)
        ? (record.state as TurnState)
        : 'queued',
      prompt: record.prompt,
      observedWorking: record.observedWorking,
      startedAt: record.startedAt ? new Date(record.startedAt) : null,
      endedAt: record.endedAt ? new Date(record.endedAt) : null,
      exitCode: record.exitCode,
      agentSessionId: record.agentSessionId,
      result: record.result,
      failureDetail: record.failureDetail,
      costUsd: record.costUsd === null ? null : Number(record.costUsd),
      permissionDenials: record.permissionDenials,
      outputRef: record.outputRef,
      model: record.model,
      inputTokens: tokenCount(record.inputTokens),
      outputTokens: tokenCount(record.outputTokens),
      cacheReadTokens: tokenCount(record.cacheReadTokens),
      cacheWriteTokens: tokenCount(record.cacheWriteTokens),
    };
  }

  /**
   * One row of the weekly usage aggregate. Postgres sums `bigint` and `numeric`
   * into `numeric`, which `pg` returns as a string, so every figure is read
   * here once rather than at each caller.
   */
  usageWeekToRead(row: unknown): SessionUsageWeek {
    const record = typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : {};
    return {
      weekStart: String(record.weekStart),
      projectId: String(record.projectId),
      model: typeof record.model === 'string' ? record.model : null,
      inputTokens: summed(record.inputTokens),
      outputTokens: summed(record.outputTokens),
      cacheReadTokens: summed(record.cacheReadTokens),
      cacheWriteTokens: summed(record.cacheWriteTokens),
      costUsd: summed(record.costUsd),
      turns: summed(record.turns),
    };
  }

  turnToPersistence(session: WorkSessionEntity, turn: SessionTurnFold): SessionTurnOrmEntity {
    const record = new SessionTurnOrmEntity();
    record.organizationId = session.organizationId;
    record.sessionId = session.id;
    record.seq = turn.seq;
    record.origin = turn.origin;
    record.drive = turn.drive;
    record.state = turn.state;
    record.prompt = turn.prompt;
    record.observedWorking = turn.observedWorking;
    record.startedAt = turn.startedAt;
    record.endedAt = turn.endedAt;
    record.exitCode = turn.exitCode;
    record.agentSessionId = turn.agentSessionId;
    record.result = turn.result;
    record.failureDetail = turn.failureDetail;
    record.costUsd = turn.costUsd === null ? null : turn.costUsd.toFixed(6);
    record.permissionDenials = turn.permissionDenials;
    record.outputRef = turn.outputRef;
    record.model = turn.model;
    record.inputTokens = turn.inputTokens === null ? null : String(turn.inputTokens);
    record.outputTokens = turn.outputTokens === null ? null : String(turn.outputTokens);
    record.cacheReadTokens = turn.cacheReadTokens === null ? null : String(turn.cacheReadTokens);
    record.cacheWriteTokens = turn.cacheWriteTokens === null ? null : String(turn.cacheWriteTokens);
    return record;
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
        permission: launchPermissionFor(record.agent, record.launchPermission),
        effort: record.launchEffort,
      },
      projectId: record.projectId,
      closeRequest: record.closeRequestedAt
        ? {
            requestedAt: record.closeRequestedAt,
            acceptUnpushedWork: record.closeAcceptsUnpushedWork,
          }
        : null,
      closeRefusal: record.closeRefusalCode
        ? { code: record.closeRefusalCode, detail: record.closeRefusalDetail }
        : null,
      pendingDecision: this.decisionOf(record.pendingDecision),
    };
  }

  /**
   * A cloud session's files as its task lists them: each file's type beside
   * the link it is downloaded from, in order (`cloudTaskWithFiles`).
   */
  static toCloudTaskFiles(
    files: readonly { mediaType: SessionFileMediaType }[],
    urls: readonly string[],
  ): CloudTaskFile[] {
    return files.map((file, i) => ({ url: urls[i] ?? '', mediaType: file.mediaType }));
  }

  /** What `POST /sessions/attachments` answers for an upload it staged. */
  static toAttachmentResponse(
    id: string,
    mediaType: SessionFileMediaType,
    data: Buffer,
  ): SessionAttachmentDto {
    return { id, mediaType, size: data.length };
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

  /**
   * A batch as the append's single `INSERT` reads it: a JSON array for
   * `jsonb_to_recordset`, each entry numbered so the statement can keep the
   * caller's order when it hands out `seq`. An absent payload is `{}`, an absent
   * `occurredAt` is now.
   */
  toAppendRecordset(events: readonly NewSessionEvent[]): string {
    const now = new Date();
    return JSON.stringify(
      events.map((event, ord) => ({
        ord,
        idempotencyKey: event.idempotencyKey,
        source: event.source,
        kind: event.kind,
        payload: event.payload ?? {},
        occurredAt: (event.occurredAt ?? now).toISOString(),
      })),
    );
  }

  /** A row the batched append landed, as the log entry the fold reads. */
  appendedToDomain(sessionId: string, row: AppendedEventRow): WorkSessionEventEntity {
    return WorkSessionEventEntity.create({
      id: row.id ?? '',
      createdAt: row.recordedAt,
      updatedAt: row.recordedAt,
      props: {
        sessionId,
        seq: row.seq,
        idempotencyKey: row.idempotencyKey,
        source: row.source,
        kind: row.kind,
        payload: row.payload,
        occurredAt: row.occurredAt,
        recordedAt: row.recordedAt,
      },
    });
  }

  toPageMeta(page: SessionListPage): SessionPageMetaDto {
    const meta = new SessionPageMetaDto();
    meta.limit = page.limit;
    meta.nextCursor = page.nextCursor ? encodeSessionListCursor(page.nextCursor) : null;
    if (page.total !== undefined && page.page !== undefined) {
      Object.assign(meta, toPageMeta({ count: page.total, page: page.page, limit: page.limit }));
    }
    return meta;
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
   * `hints` rides the session rather than a second envelope because the console
   * renders the row it just changed.
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
    dto.place = entity.place;
    dto.folderPath = entity.folderPath;
    dto.cloudSessionId = entity.cloudSessionId;
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
    dto.observedSince = entity.fold.observedSince;
    dto.stateSeq = entity.stateSeq;
    dto.stoppedAt = entity.stoppedAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.hints = options.hints ?? [];
    const { closeRequest, closeRefusal } = entity;
    dto.closeRequest = closeRequest
      ? {
          requestedAt: closeRequest.requestedAt,
          acceptUnpushedWork: closeRequest.acceptUnpushedWork,
        }
      : null;
    dto.closeRefusal = closeRefusal
      ? { code: closeRefusal.code, detail: closeRefusal.detail }
      : null;
    dto.decision = this.decisionToResponse(entity.pendingDecision);
    // Retired checkouts are left out: the console renders what is on disk, and the
    // row survives only so its directory name is never reissued.
    dto.checkouts = entity.liveCheckouts.map((checkout) => this.checkoutToResponse(checkout));
    dto.cloud = entity.cloudRun ? this.cloudRunToResponse(entity.cloudRun) : null;
    return dto;
  }

  /** The pending decision as the response states it, every nullable spelled out. */
  decisionToResponse(decision: SessionDecision | null): SessionDecisionResponseDto | null {
    if (!decision) return null;
    if (decision.kind === 'question') {
      return {
        kind: 'question',
        id: decision.id,
        questions: decision.questions.map((question) => ({
          header: question.header,
          question: question.question,
          multiSelect: question.multiSelect,
          options: question.options.map((option) => ({
            label: option.label,
            description: option.description,
          })),
        })),
      };
    }
    return {
      kind: 'permission',
      id: decision.id,
      title: decision.title,
      detail: decision.detail,
      options: decision.options.map((option) => ({ label: option.label })),
    };
  }

  cloudRunToDomain(record: SessionCloudRunOrmEntity): SessionCloudRunEntity {
    return SessionCloudRunEntity.create({
      id: record.sessionId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        provider: record.provider,
        externalId: record.externalId,
        url: record.url,
        repositoryUrl: record.repositoryUrl,
        latestRunId: record.latestRunId,
        status: record.status,
        branch: record.branch,
        pullRequestUrl: record.pullRequestUrl,
        summary: record.summary,
        syncedAt: record.syncedAt,
      },
    });
  }

  cloudRunToPersistence(entity: SessionCloudRunEntity): SessionCloudRunOrmEntity {
    const record = new SessionCloudRunOrmEntity();
    record.sessionId = entity.sessionId;
    record.organizationId = entity.organizationId;
    record.provider = entity.provider;
    record.externalId = entity.externalId;
    record.url = entity.url;
    record.repositoryUrl = entity.repositoryUrl;
    record.latestRunId = entity.latestRunId;
    record.status = entity.status;
    record.branch = entity.branch;
    record.pullRequestUrl = entity.pullRequestUrl;
    record.summary = entity.summary;
    record.syncedAt = entity.syncedAt;
    return record;
  }

  cloudRunToResponse(entity: SessionCloudRunEntity): SessionCloudRunResponseDto {
    const dto = new SessionCloudRunResponseDto();
    dto.provider = entity.provider;
    dto.url = entity.url;
    dto.repositoryUrl = entity.repositoryUrl;
    dto.status = entity.status;
    dto.branch = entity.branch;
    dto.pullRequestUrl = entity.pullRequestUrl;
    dto.syncedAt = entity.syncedAt;
    return dto;
  }

  /** What a cloud session asks its vendor to start, under the session's own id. */
  toCloudLaunch(
    sessionId: string,
    input: StartCloudSessionDto,
    source: { repositoryUrl: string; startingRef: string },
  ): CloudAgentLaunch {
    return {
      id: sessionId,
      prompt: input.prompt,
      repositoryUrl: source.repositoryUrl,
      startingRef: source.startingRef,
      model: input.model ?? null,
    };
  }

  /** The run the vendor started, as the session's vendor half keeps it. */
  toLaunchedCloudRun(
    session: { id: string; organizationId: string },
    input: StartCloudSessionDto,
    launched: { externalId: string; url: string | null; run: CloudRunReport },
    repositoryUrl: string,
    now: Date,
  ): SessionCloudRunEntity {
    return SessionCloudRunEntity.launched(
      {
        organizationId: session.organizationId,
        sessionId: session.id,
        provider: input.provider,
        externalId: launched.externalId,
        url: launched.url,
        repositoryUrl,
        run: launched.run,
      },
      now,
    );
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

/**
 * A `bigint` column as the fold reads it. `pg` returns bigint as a string so
 * that nothing past 2^53 is silently rounded; a token count never gets there,
 * and one that somehow did reads as unmeasured rather than as a wrong number.
 */
function tokenCount(value: string | null): number | null {
  if (value === null) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

/** A sum as the aggregate returns it: a numeric string, a number, or null for nothing summed. */
function summed(value: unknown): number {
  const total = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(total) ? total : 0;
}
