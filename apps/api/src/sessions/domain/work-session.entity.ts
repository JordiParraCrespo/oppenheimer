import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import type { SessionGroup, SessionState } from '@oppenheimer/shared';
import { SessionCreatedDomainEvent } from './events/session-created.domain-event';
import { SessionStateChangedDomainEvent } from './events/session-state-changed.domain-event';
import type { SessionCheckoutEntity } from './session-checkout.entity';
import {
  type AgentObservation,
  foldAgentObservation,
  type SessionReview,
  sessionGroup,
} from './session-group.policy';
import { SESSION_SLUG_PATTERN } from './session-slug.policy';
import type { SessionAgent } from './session-state.policy';
import {
  foldSessionEvent,
  INITIAL_SESSION_FOLD,
  type SessionFold,
  type SessionLogEntry,
  type SessionNameSource,
} from './session-state.policy';
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
  /** Where the agent is launched. Null means the session directory itself. */
  cwdCheckoutId: string | null;
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
 * **`recordEvent` is the only way the fold moves.** There is no `setState`, no
 * `markStopped` and no `setName`: `work_session.state` is a projection of the
 * append-only log, so writing it directly would create a second truth that a
 * replay would then disagree with (`product/versions/mvp/03-control-plane.md`).
 * The checkouts are the aggregate's other half and are added and retired through
 * it, because a checkout row's columns are not a fold of anything — but every one
 * of those changes is accompanied by a log entry, so the log still explains the
 * row.
 *
 * Rows are never hard-deleted. Closing records `session.closed`, the state folds
 * to `resolved` and the row stays for ever: `uq (projectId, slug)` is the
 * tombstone that stops a new session inheriting a retired session's directory
 * name, and therefore a stranger's agent conversation state.
 */
export class WorkSessionEntity extends AggregateRoot<WorkSessionProps> {
  /**
   * What the log last observed the agent doing, and what GitHub says about the
   * branch. Neither is a column: both are folded from the log by whoever is
   * holding it, which is why they are null on an aggregate rehydrated from a row.
   */
  private observation: AgentObservation | null = null;
  private review: SessionReview | null = null;
  private paneMissing = false;

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
        organizationId: props.organizationId,
        projectId: props.projectId,
        createdByUserId: props.createdByUserId,
        hostId: props.hostId,
        slug: props.slug,
        agent: props.agent,
        cwdCheckoutId: null,
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

  /** The derived group, for the wire. Absent observations read as "nothing reported". */
  group(now: Date = new Date()): SessionGroup {
    return sessionGroup(
      {
        fold: this.fold,
        observation: this.observation,
        review: this.review,
        paneMissing: this.paneMissing,
      },
      now,
    );
  }

  /** The fold as a value, for a policy that wants it without the aggregate. */
  get fold(): SessionFold {
    return {
      state: this.props.state,
      stateSeq: this.props.stateSeq,
      agentSessionId: this.props.agentSessionId,
      lastEventAt: this.props.lastEventAt,
      stoppedAt: this.props.stoppedAt,
      name: this.props.name,
      nameSource: this.props.nameSource,
    };
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
    const folded = foldSessionEvent(this.fold, entry);
    this.props.state = folded.state;
    this.props.stateSeq = folded.stateSeq;
    this.props.agentSessionId = folded.agentSessionId;
    this.props.lastEventAt = folded.lastEventAt;
    this.props.stoppedAt = folded.stoppedAt;
    this.props.name = folded.name;
    this.props.nameSource = folded.nameSource;
    this.observation = foldAgentObservation(this.observation, entry);
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
   * Add a checkout. The caller derives its directory name from
   * `checkoutDirectoryName` over {@link usedDirectoryNames}, so a name is never
   * reissued inside a session.
   */
  attachCheckout(checkout: SessionCheckoutEntity): void {
    if (this.props.checkouts.some((existing) => existing.id === checkout.id)) return;
    this.props.checkouts.push(checkout);
    this.setUpdatedAt(new Date());
  }

  /**
   * Retire a checkout, and step the agent out of it if that is where it was.
   *
   * Nulling `cwdCheckoutId` here rather than relying on the foreign key's
   * `ON DELETE SET NULL` is the point: checkout rows are never deleted, so that
   * clause never fires. The session degrades to its own directory instead of
   * pointing at a checkout that is no longer on disk.
   */
  retireCheckout(checkoutId: string, at: Date): SessionCheckoutEntity | null {
    const checkout = this.props.checkouts.find((candidate) => candidate.id === checkoutId);
    if (!checkout) return null;
    checkout.remove(at);
    if (this.props.cwdCheckoutId === checkoutId) this.props.cwdCheckoutId = null;
    this.setUpdatedAt(new Date());
    return checkout;
  }

  /** Where the agent is launched. Must name a checkout of this session. */
  setCwdCheckout(checkoutId: string | null): void {
    if (
      checkoutId !== null &&
      !this.props.checkouts.some((checkout) => checkout.id === checkoutId)
    ) {
      throw new ArgumentInvalidException(
        'A session can only be launched inside one of its own checkouts',
      );
    }
    this.props.cwdCheckoutId = checkoutId;
    this.setUpdatedAt(new Date());
  }

  /**
   * Hand the aggregate what the log says about the agent and the branch. Used by
   * whoever holds the log — the relay's read path — so the group it reports is the
   * group the sidebar should show.
   */
  observe(input: {
    observation?: AgentObservation | null;
    review?: SessionReview | null;
    paneMissing?: boolean;
  }): void {
    if (input.observation !== undefined) this.observation = input.observation;
    if (input.review !== undefined) this.review = input.review;
    if (input.paneMissing !== undefined) this.paneMissing = input.paneMissing;
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
