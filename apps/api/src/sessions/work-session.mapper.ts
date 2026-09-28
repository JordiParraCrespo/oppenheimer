import { Injectable } from '@nestjs/common';
import { ArgumentInvalidException, type Mapper } from '@oppenheimer/backend-ddd';
import { type CreateSessionDto, SESSION_SORTS, type SessionSortDto } from '@oppenheimer/shared';
import { SessionCheckoutOrmEntity } from './database/session-checkout.orm-entity';
import { SessionTurnOrmEntity } from './database/session-turn.orm-entity';
import { WorkSessionOrmEntity } from './database/work-session.orm-entity';
import type {
  NewSessionEvent,
  SessionListCursor,
  SessionListPage,
} from './database/work-session.repository.port';
import { WorkSessionEventOrmEntity } from './database/work-session-event.orm-entity';
import { SessionCheckoutEntity } from './domain/session-checkout.entity';
import {
  launchPermissionFor,
  SESSION_EVENT_KINDS,
  type SessionAgent,
  type SessionFold,
  type SessionLaunchFold,
} from './domain/session-state.policy';
import {
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
import {
  SessionCheckoutResponseDto,
  SessionPageMetaDto,
  SessionResponseDto,
} from './dtos/session.response.dto';
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
        createdByUserId: record.createdByUserId,
        hostId: record.hostId,
        slug: record.slug,
        agent: record.agent as SessionAgent,
        idempotencyKey: record.idempotencyKey,
        checkouts: [],
        origin: record.origin === 'automation' ? 'automation' : 'person',
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
        // Null is a session whose agent has no approvals; for any other agent
        // a missing level reads as the one that asks before every action.
        permission: launchPermissionFor(record.agent, record.launchPermission),
        effort: record.launchEffort,
      },
      projectId: record.projectId,
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

  /**
   * A batch as the append's single `INSERT` reads it: a JSON array for
   * `jsonb_to_recordset`, each entry numbered so the statement can keep the
   * caller's order when it hands out `seq`. What `createNew` would default is
   * defaulted here — an absent payload is `{}`, an absent `occurredAt` is now —
   * so a row written in a batch is the row that would have been written alone.
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

  /**
   * The list's cursor as the client holds it: opaque, base64url JSON of the sort
   * it was issued for, the last row's sort key and its id. The key is the text
   * Postgres printed, never a JavaScript `Date`, because a `Date` keeps
   * milliseconds and a `timestamptz` keeps microseconds — a truncated key would
   * skip the rows that share its millisecond.
   */
  toListCursor(cursor: SessionListCursor): string {
    return Buffer.from(
      JSON.stringify({ s: cursor.sort, k: cursor.key, i: cursor.id }),
      'utf8',
    ).toString('base64url');
  }

  /**
   * A cursor back from the client, for the sort it is now asking in. Anything
   * that is not one this API issued for that sort is a 400: a cursor issued
   * for `recent` compared against `name` keys would page through nonsense.
   */
  fromListCursor(text: string, sort: SessionSortDto): SessionListCursor {
    const invalid = () =>
      new ArgumentInvalidException('`cursor` is not a cursor this list issued for this sort');
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(text, 'base64url').toString('utf8'));
    } catch {
      throw invalid();
    }
    if (typeof parsed !== 'object' || parsed === null) throw invalid();
    const { s, k, i } = parsed as { s?: unknown; k?: unknown; i?: unknown };
    if (
      typeof s !== 'string' ||
      !(SESSION_SORTS as readonly string[]).includes(s) ||
      typeof k !== 'string' ||
      typeof i !== 'string' ||
      !UUID_PATTERN.test(i)
    ) {
      throw invalid();
    }
    if (s !== sort) {
      throw new ArgumentInvalidException(
        `\`cursor\` was issued for sort \`${s}\`; this request sorts by \`${sort}\``,
      );
    }
    return { sort, key: k, id: i };
  }

  /**
   * A page's `meta`. `nextCursor` is always there; the counts only in page mode,
   * because a cursor walk never counts.
   */
  toPageMeta(page: SessionListPage): SessionPageMetaDto {
    const meta = new SessionPageMetaDto();
    meta.limit = page.limit;
    meta.nextCursor = page.nextCursor ? this.toListCursor(page.nextCursor) : null;
    if (page.total !== undefined && page.page !== undefined) {
      meta.total = page.total;
      meta.page = page.page;
      meta.totalPages = Math.ceil(page.total / page.limit);
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

/** What `fromListCursor` accepts as a session id, before Postgres casts it. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
