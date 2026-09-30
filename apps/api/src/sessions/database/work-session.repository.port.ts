import type { AccessScope } from '@oppenheimer/backend-authz';
import type { SessionSortDto, SessionState } from '@oppenheimer/shared';
import type { Option } from 'oxide.ts';
import type { SessionCheckoutEntity } from '../domain/session-checkout.entity';
import type { SessionLaunchImage } from '../domain/session-launch-image.types';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import type {
  SessionEventSource,
  WorkSessionEventEntity,
} from '../domain/work-session-event.entity';

/** One entry a caller wants appended. `seq` is the control plane's to assign. */
export interface NewSessionEvent {
  idempotencyKey: string;
  source: SessionEventSource;
  kind: string;
  payload?: unknown;
  occurredAt?: Date;
}

/**
 * What an append came back with, in the shape the link's `events.ack` needs.
 *
 * `accepted` is every key now durable — the rows that landed **and** the rows a
 * previous attempt had already landed, because `DO NOTHING` makes those
 * indistinguishable and both mean "stop resending this". A key in neither list was
 * not accounted for, so the writer resends the batch.
 */
export interface SessionAppendOutcome {
  accepted: string[];
  rejected: { idempotencyKey: string; reason: string }[];
  /** The rows this call created, in `seq` order. */
  appended: WorkSessionEventEntity[];
}

/**
 * Where a keyset walk of the list stands: the sort it was issued for, the last
 * row's sort key as Postgres printed it, and the last row's id.
 */
export interface SessionListCursor {
  sort: SessionSortDto;
  key: string;
  id: string;
}

export interface SessionFilters {
  /** Page mode: 1-based. Ignored when `cursor` is set. */
  page: number;
  limit: number;
  /** Cursor mode: the rows after this one, in the same sort, with no count. */
  cursor?: SessionListCursor;
  projectId?: string;
  hostId?: string;
  /** The stored lifecycle. The derived group is computed on read and cannot be filtered. */
  state?: SessionState;
  /** Sessions with a live checkout of this repository. */
  githubRepoId?: number;
  agent?: string;
  /** Last activity first by default. */
  sort?: SessionSortDto;
}

/**
 * One page of the list. `total` and `page` are page mode's alone: a cursor walk
 * never counts. `nextCursor` is there in both modes, null on the last page, so a
 * client can start with a page and carry on by cursor.
 */
export interface SessionListPage {
  data: WorkSessionEntity[];
  limit: number;
  total?: number;
  page?: number;
  nextCursor: SessionListCursor | null;
}

export interface SessionEventPage {
  events: WorkSessionEventEntity[];
  /** The `seq` to ask after next, or null at the end of the log. */
  nextSeq: number | null;
}

/**
 * A session on a host as the link's hello reconciliation reads it: the row,
 * and the first prompt if the
 * log holds one — everything a re-dispatched `session.create` needs.
 */
export interface HostSessionRow {
  session: WorkSessionEntity;
  prompt?: string;
  /** The images the first task carries, off the same `prompt.first` entry. */
  images?: SessionLaunchImage[];
}

/**
 * Every person-facing read takes an {@link AccessScope}, so authorization is something
 * the compiler asks for, not something a handler remembers. Writes take the
 * **aggregate**, the proof it was loaded under a scope: no `appendEvents(sessionId, …)`
 * is reachable with an id a person never had permission to read.
 *
 * The **machine path** is the named exception, `appendEventsForHost(hostId, sessionId,
 * …)`: the proof is the host's credential, checked by the link, and the row lock
 * appends only when the locked row names that host, the reasoning
 * `findOneByIdForMachine` rests on too.
 *
 * The children have no scoped reads: `session_checkout` and `work_session_event` are
 * read only through their session, keeping one tenant predicate instead of three.
 */
export interface WorkSessionRepositoryPort {
  /** Every unresolved session on a host, unscoped: the host proved who it is. */
  findUnresolvedForHostForMachine(hostId: string): Promise<HostSessionRow[]>;

  /**
   * The sessions on a host whose agent is up — neither resolved nor stopped —
   * unscoped, because the caller is the host's own lifecycle rather than a
   * person: removing a machine stops whatever runs on it, whichever workspace
   * started it.
   */
  findRunningOnHostForSystem(hostId: string): Promise<WorkSessionEntity[]>;

  /**
   * How many sessions are running on each of these hosts, by the same rule.
   * The hosts were read under the caller's scope before they got here, and the
   * answer is a count, never a row. A host with none is absent from the map.
   */
  countRunningByHost(hostIds: readonly string[]): Promise<Map<string, number>>;
  /**
   * Delete every session of a workspace with its checkouts and log, in one
   * transaction. Only deleting the account that owns the workspace asks it:
   * a session is otherwise never hard-deleted.
   */
  eraseWorkspace(organizationId: string): Promise<void>;

  /**
   * Insert the session, its checkouts and its first log entries in one transaction,
   * unless the caller's `Idempotency-Key` already created it or the project was
   * archived out from under it. `created: false, projectArchived: false` is the retry
   * after a lost response and returns the existing session, never a second directory
   * and branch. `projectArchived: true` is the race the project row lock decides: the
   * archive committed first.
   */
  createIfUnclaimed(
    session: WorkSessionEntity,
    events: NewSessionEvent[],
  ): Promise<{ session: WorkSessionEntity; created: boolean; projectArchived: boolean }>;

  /**
   * Append to the log and fold onto the row, in one transaction.
   *
   * `seq` is allocated under `SELECT … FOR UPDATE` on the session row, so
   * concurrent appenders serialise and the log stays dense. The batch lands in one
   * `INSERT` that skips keys already in the log, so a replay is idempotent per key. The append and
   * the fold commit together, so the sidebar is never eventually-consistent with
   * its own log.
   */
  appendEvents(
    session: WorkSessionEntity,
    events: NewSessionEvent[],
  ): Promise<SessionAppendOutcome>;

  /**
   * The runner's append to a session its authenticated host holds. The row lock
   * checks the host, so nothing is read before the transaction, and the aggregate is
   * built from the locked row. Checkouts are loaded, in the transaction, only when
   * the batch holds a `session.checkout_removed`, the one entry whose fold touches
   * them.
   *
   * `None` when the session is missing or on another host, answered alike so a host
   * cannot probe for ids; nothing was written.
   */
  appendEventsForHost(
    hostId: string,
    sessionId: string,
    events: NewSessionEvent[],
  ): Promise<Option<{ session: WorkSessionEntity; outcome: SessionAppendOutcome }>>;

  /**
   * Append a move and fold it, in one transaction with a share lock on the target
   * project — the same lock creating a session takes, and for the same reason: the
   * archive command takes `FOR UPDATE` on that row and then counts the sessions
   * listed in it, so a move and an archive cannot both win. `project-archived`
   * when the archive committed first.
   */
  appendMove(
    session: WorkSessionEntity,
    targetProjectId: string,
    events: NewSessionEvent[],
  ): Promise<'moved' | 'project-archived'>;

  insertCheckout(
    session: WorkSessionEntity,
    checkout: SessionCheckoutEntity,
    events: NewSessionEvent[],
  ): Promise<SessionAppendOutcome>;

  /**
   * Retire a checkout: `removedAt`, the session's `cwdCheckoutId` when it pointed
   * at it, and the log entries, together. The row itself is never deleted.
   */
  retireCheckout(
    session: WorkSessionEntity,
    checkout: SessionCheckoutEntity,
    events: NewSessionEvent[],
  ): Promise<SessionAppendOutcome>;

  /**
   * Sessions the caller can reach, last activity first unless `sort` says
   * otherwise: by page with a count, or by `cursor` without one.
   */
  findAllPaginated(scope: AccessScope, filters: SessionFilters): Promise<SessionListPage>;

  /** `None` both for a missing session and for one outside the caller's scope. */
  findOneById(scope: AccessScope, id: string): Promise<Option<WorkSessionEntity>>;

  /** The session a client's `Idempotency-Key` already created, if any. */
  findOneByIdempotencyKey(scope: AccessScope, key: string): Promise<Option<WorkSessionEntity>>;

  /**
   * The session a runner is reporting about. Unscoped by necessity: the writer is a
   * machine proving its own identity, and there is no person on the request to
   * scope by. The caller must check the session belongs to the host that presented
   * the credential.
   */
  findOneByIdForMachine(id: string): Promise<Option<WorkSessionEntity>>;

  /** A page of the log, by `seq`. The session is the authorization. */
  findEvents(
    session: WorkSessionEntity,
    afterSeq: number | undefined,
    limit: number,
  ): Promise<SessionEventPage>;

  /**
   * The one question archiving a project has to ask, and the reason archiving
   * ships with this module rather than with `projects/`: a placeholder answering
   * "none" would be fail-open on a destructive path.
   */
  countUnresolvedForProject(scope: AccessScope, projectId: string): Promise<number>;
}
