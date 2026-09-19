import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Paginated } from '@oppenheimer/backend-ddd';
import type { SessionState } from '@oppenheimer/shared';
import type { Option } from 'oxide.ts';
import type { SessionCheckoutEntity } from '../domain/session-checkout.entity';
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

export interface SessionFilters {
  page: number;
  limit: number;
  projectId?: string;
  hostId?: string;
  /** The stored lifecycle. The derived group is computed on read and cannot be filtered. */
  state?: SessionState;
}

export interface SessionEventPage {
  events: WorkSessionEventEntity[];
  /** The `seq` to ask after next, or null at the end of the log. */
  nextSeq: number | null;
}

/**
 * Port for the work-session aggregate: the row, its checkouts, and its log.
 *
 * Every person-facing read takes an {@link AccessScope}, so "this query is
 * authorized" is something the compiler asks for rather than something a handler
 * has to remember. The writes are different: they take the **aggregate**, which is
 * the proof that it was loaded under a scope in the first place — there is no
 * `appendEvents(sessionId, …)` a caller could reach with an id it never had
 * permission to read.
 *
 * The children have no scoped reads of their own. `session_checkout` and
 * `work_session_event` declare no resource and are only ever read through their
 * session, which is what keeps one tenant predicate in the system instead of three.
 */
export interface WorkSessionRepositoryPort {
  /**
   * Insert the session, its checkouts and the first entries of its log in one
   * transaction, unless the caller's `Idempotency-Key` already created it.
   *
   * `created: false` is the retry-after-a-lost-response case and returns the
   * session that already exists — never a second directory and a second branch.
   */
  createIfUnclaimed(
    session: WorkSessionEntity,
    events: NewSessionEvent[],
  ): Promise<{ session: WorkSessionEntity; created: boolean }>;

  /**
   * Append to the log and fold onto the row, in one transaction.
   *
   * `seq` is allocated under `SELECT … FOR UPDATE` on the session row, so
   * concurrent appenders serialise and the log stays dense; the per-row
   * `ON CONFLICT DO NOTHING` is what makes a replay idempotent. The append and
   * the fold commit together, so the sidebar is never eventually-consistent with
   * its own log.
   */
  appendEvents(
    session: WorkSessionEntity,
    events: NewSessionEvent[],
  ): Promise<SessionAppendOutcome>;

  /** Add a checkout to a session, with the log entries that explain it. */
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

  /** Sessions the caller can reach, newest first. */
  findAllPaginated(
    scope: AccessScope,
    filters: SessionFilters,
  ): Promise<Paginated<WorkSessionEntity>>;

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
    sessionId: string,
    afterSeq: number | undefined,
    limit: number,
  ): Promise<SessionEventPage>;

  /**
   * How many sessions in this project are not resolved.
   *
   * The one question archiving a project has to ask, and the reason archiving
   * ships with this module rather than with `projects/`: a placeholder answering
   * "none" would be fail-open on a destructive path.
   */
  countUnresolvedForProject(scope: AccessScope, projectId: string): Promise<number>;
}
