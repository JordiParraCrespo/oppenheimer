import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
  type ErrorDefinition,
} from '@oppenheimer/backend-ddd';
import type { SessionGroup, SessionState } from '@oppenheimer/shared';
import { SessionCreatedDomainEvent } from './events/session-created.domain-event';
import { SessionStateChangedDomainEvent } from './events/session-state-changed.domain-event';
import type { SessionCheckoutEntity } from './session-checkout.entity';
import { sessionGroup } from './session-group.policy';
import { SESSION_SLUG_PATTERN } from './session-slug.policy';
import {
  foldSessionEvent,
  INITIAL_SESSION_FOLD,
  launchPermissionFor,
  SESSION_EVENT_KINDS,
  type SessionAgent,
  type SessionFold,
  type SessionLaunchFold,
  type SessionLogEntry,
  type SessionNameSource,
} from './session-state.policy';
import { SessionErrors } from './sessions.errors';
import type { WorkSessionEventEntity } from './work-session-event.entity';

export interface WorkSessionProps extends SessionFold {
  organizationId: string;
  projectId: string;
  createdByUserId: string;
  /**
   * The host the work runs on. It is the one reference in the schema a handler
   * guards rather than a constraint: a host belongs to a person and has no
   * workspace column, so a composite key cannot express it.
   */
  hostId: string;
  slug: string;
  agent: SessionAgent;
  /** The caller's `Idempotency-Key`, stored so a retry returns this session. */
  idempotencyKey: string | null;
  /** Members of the aggregate, including retired ones. */
  checkouts: SessionCheckoutEntity[];
}

export interface CreateWorkSessionProps {
  organizationId: string;
  projectId: string;
  createdByUserId: string;
  hostId: string;
  slug: string;
  agent: SessionAgent;
  name?: string;
  idempotencyKey?: string | null;
}

/**
 * Work-session aggregate root — a terminal, an agent, and a set of checkouts.
 *
 * **`recordEvent` is the only mutator.** There is no `setState`, no `setName` and
 * no `setCwdCheckout`: every column of `work_session` is a projection of the
 * append-only log, so writing one directly would create a second truth that a
 * replay then disagrees with (`product/versions/mvp/03-control-plane.md`). That
 * includes which checkout the agent was launched in, and it includes the inputs
 * the sidebar's dot is computed from.
 *
 * The one thing that is not a fold is **adding a member**: a checkout is a row in
 * another table with its own unique constraints, and inserting it is not a
 * projection of anything. Retiring one is, because it is a consequence of an
 * event, so `session.checkout_removed` is what marks the child and steps the agent
 * out of it.
 *
 * Rows are never hard-deleted. Closing records `session.closed`, the state folds
 * to `resolved` and the row stays for ever: `uq (projectId, slug)` is the
 * tombstone that stops a new session inheriting a retired session's directory
 * name, and therefore a stranger's agent conversation state.
 */
export class WorkSessionEntity extends AggregateRoot<WorkSessionProps> {
  static create(create: CreateEntityProps<WorkSessionProps>): WorkSessionEntity {
    return new WorkSessionEntity(create);
  }

  /**
   * A requested session: the row, its slug, and the first entry of its log.
   *
   * The name starts equal to the slug. It reads fine on its own
   * ("bold-otter-3f9a7k") and is replaced by a title derived from the first
   * prompt, so a deployment that names nothing loses nothing.
   */
  static request(props: CreateWorkSessionProps): WorkSessionEntity {
    const session = new WorkSessionEntity({
      id: randomUUID(),
      props: {
        ...INITIAL_SESSION_FOLD,
        // The request event states the launch; until it is folded, the level is
        // the agent's absent one — `ask`, or none for the blank terminal.
        launch: {
          ...INITIAL_SESSION_FOLD.launch,
          permission: launchPermissionFor(props.agent, null),
        },
        organizationId: props.organizationId,
        projectId: props.projectId,
        createdByUserId: props.createdByUserId,
        hostId: props.hostId,
        slug: props.slug,
        agent: props.agent,
        idempotencyKey: props.idempotencyKey ?? null,
        checkouts: [],
        name: props.name ?? props.slug,
        nameSource: props.name ? 'user' : null,
      },
    });

    session.addEvent(
      new SessionCreatedDomainEvent({
        aggregateId: session.id,
        reason: 'a session was requested and owes its host a job',
        organizationId: props.organizationId,
        projectId: props.projectId,
        hostId: props.hostId,
        slug: props.slug,
        agent: props.agent,
      }),
    );
    return session;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get createdByUserId(): string {
    return this.props.createdByUserId;
  }

  get hostId(): string {
    return this.props.hostId;
  }

  get slug(): string {
    return this.props.slug;
  }

  /** The display name, which is the slug until something names the session. */
  get name(): string {
    return this.props.name ?? this.props.slug;
  }

  get nameSource(): SessionNameSource | null {
    return this.props.nameSource;
  }

  get agent(): SessionAgent {
    return this.props.agent;
  }

  get cwdCheckoutId(): string | null {
    return this.props.cwdCheckoutId;
  }

  /**
   * How this session was launched. Read by the dispatcher building a job for the
   * host, and by the console's engine button.
   */
  get launch(): SessionLaunchFold {
    return this.props.launch;
  }

  get idempotencyKey(): string | null {
    return this.props.idempotencyKey;
  }

  get state(): SessionState {
    return this.props.state;
  }

  get stateSeq(): number {
    return this.props.stateSeq;
  }

  get agentSessionId(): string | null {
    return this.props.agentSessionId;
  }

  get lastEventAt(): Date | null {
    return this.props.lastEventAt;
  }

  get stoppedAt(): Date | null {
    return this.props.stoppedAt;
  }

  get isResolved(): boolean {
    return this.props.state === 'resolved';
  }

  /** Every checkout, retired ones included. */
  /**
   * Why this session cannot take input right now — typed keys, a pasted
   * image — or `null` when it can. Closed is final and stopped has no window
   * to type into; both are facts about the session, whatever the input is.
   */
  get inputRefusal(): ErrorDefinition | null {
    if (this.isResolved) return SessionErrors.ALREADY_RESOLVED;
    if (this.stoppedAt) return SessionErrors.NOT_RUNNING;
    return null;
  }

  get checkouts(): readonly SessionCheckoutEntity[] {
    return this.props.checkouts;
  }

  /** The checkouts still on disk, in the order they were added. */
  get liveCheckouts(): readonly SessionCheckoutEntity[] {
    return this.props.checkouts.filter((checkout) => !checkout.isRemoved);
  }

  /** Every directory name this session has ever used, so none is reissued. */
  get usedDirectoryNames(): string[] {
    return this.props.checkouts.map((checkout) => checkout.directoryName);
  }

  /**
   * The derived group, for the wire — a function of the row, because every input
   * it reads is a folded column.
   */
  group(now: Date = new Date()): SessionGroup {
    return sessionGroup(this.fold, now);
  }

  /** The fold as a value, for a policy or a mapper that wants it without the aggregate. */
  get fold(): SessionFold {
    return {
      state: this.props.state,
      stateSeq: this.props.stateSeq,
      agentSessionId: this.props.agentSessionId,
      lastEventAt: this.props.lastEventAt,
      stoppedAt: this.props.stoppedAt,
      projectId: this.props.projectId,
      name: this.props.name,
      nameSource: this.props.nameSource,
      cwdCheckoutId: this.props.cwdCheckoutId,
      lastObservedState: this.props.lastObservedState,
      observedSince: this.props.observedSince,
      reportHash: this.props.reportHash,
      ackedReportHash: this.props.ackedReportHash,
      launch: this.props.launch,
    };
  }

  /**
   * Re-seat the projection on what the database says it is.
   *
   * The repository calls this **inside the row lock**, before folding a new batch:
   * an instance loaded before the lock may have been overtaken — a close can commit
   * while a stop is waiting — and folding onto the stale copy would write a
   * projection the log does not support. It is not a setter in the mutator sense;
   * it is the same load `toDomain` does, repeated once the row can no longer move.
   */
  reseatFold(fold: SessionFold): void {
    this.props.state = fold.state;
    this.props.stateSeq = fold.stateSeq;
    this.props.agentSessionId = fold.agentSessionId;
    this.props.lastEventAt = fold.lastEventAt;
    this.props.stoppedAt = fold.stoppedAt;
    if (fold.projectId) this.props.projectId = fold.projectId;
    this.props.name = fold.name;
    this.props.nameSource = fold.nameSource;
    this.props.cwdCheckoutId = fold.cwdCheckoutId;
    this.props.lastObservedState = fold.lastObservedState;
    this.props.observedSince = fold.observedSince;
    this.props.reportHash = fold.reportHash;
    this.props.ackedReportHash = fold.ackedReportHash;
    this.props.launch = fold.launch;
  }

  /**
   * Apply one log entry: the aggregate's only mutator of the fold.
   *
   * It runs the pure fold, advances the projection, and raises
   * `SessionStateChanged` only on a real transition — a heartbeat that moves
   * nothing but `lastEventAt` owes nobody a notification.
   */
  recordEvent(entry: SessionLogEntry): void {
    const before = this.props.state;
    this.reseatFold(foldSessionEvent(this.fold, entry));
    // A retired checkout is a row in another table, so the fold cannot reach it —
    // but its retirement is a consequence of this event, so it happens here rather
    // than in a setter somebody could call without one.
    if (entry.kind === SESSION_EVENT_KINDS.CHECKOUT_REMOVED) {
      const checkoutId = checkoutIdOf(entry.payload);
      const checkout = this.props.checkouts.find((candidate) => candidate.id === checkoutId);
      checkout?.remove(entry.occurredAt);
    }
    const folded = this.fold;
    this.setUpdatedAt(new Date());
    this.validate();

    if (folded.state !== before) {
      this.addEvent(
        new SessionStateChangedDomainEvent({
          aggregateId: this.id,
          reason: `the session log moved this session from ${before} to ${folded.state}`,
          organizationId: this.props.organizationId,
          from: before,
          to: folded.state,
          stateSeq: folded.stateSeq,
        }),
      );
    }
  }

  /** Replay a whole log onto the aggregate, entry by entry. */
  recordEvents(entries: readonly (SessionLogEntry | WorkSessionEventEntity)[]): void {
    for (const entry of entries) {
      this.recordEvent({
        seq: entry.seq,
        kind: entry.kind,
        payload: entry.payload,
        occurredAt: entry.occurredAt,
      });
    }
  }

  /**
   * Hold a checkout the caller has built — a **new row**, not a projection, which
   * is why it is not a fold. The caller derives its directory name from
   * `checkoutDirectoryName` over {@link usedDirectoryNames}, so a name is never
   * reissued inside a session; where the agent then runs is `session.cwd_set`,
   * which is.
   */
  attachCheckout(checkout: SessionCheckoutEntity): void {
    if (this.props.checkouts.some((existing) => existing.id === checkout.id)) return;
    this.props.checkouts.push(checkout);
    this.setUpdatedAt(new Date());
  }

  /** A checkout of this session, live or retired. */
  checkoutById(checkoutId: string): SessionCheckoutEntity | undefined {
    return this.props.checkouts.find((checkout) => checkout.id === checkoutId);
  }

  /** The key the API uses for its own log entries: the command that caused them. */
  static apiIdempotencyKey(commandId: string, kind: string): string {
    return `${kind}:${commandId}`;
  }

  public validate(): void {
    if (!this.props.organizationId?.trim()) {
      throw new ArgumentNotProvidedException('A session must belong to an organization');
    }
    if (!this.props.projectId?.trim()) {
      throw new ArgumentNotProvidedException('A session must belong to a project');
    }
    if (!this.props.hostId?.trim()) {
      throw new ArgumentNotProvidedException('A session must name a host');
    }
    // The slug is a directory on every host and a segment of the session's git
    // branch, so an invalid one is not a display problem: it is a path and a ref
    // that cannot be created.
    if (!SESSION_SLUG_PATTERN.test(this.props.slug)) {
      throw new ArgumentInvalidException(
        'A session slug is <adjective>-<noun>-<6 base36 characters>',
      );
    }
  }
}

/** The checkout an event names, narrowed once so the aggregate does not cast. */
function checkoutIdOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const value = (payload as { checkoutId?: unknown }).checkoutId;
  return typeof value === 'string' ? value : null;
}
