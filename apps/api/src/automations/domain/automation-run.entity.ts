import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import type {
  AutomationRunCause,
  AutomationRunOutcome,
  AutomationSkipReason,
} from '@oppenheimer/shared/automations';
import { AutomationRunChangedDomainEvent } from './events/automation-run-changed.domain-event';

/**
 * Why a run happened, in words that outlive the event it came from: the
 * frames' "PR #124 opened by jordiparra", "Schedule", "Manual run". Copied when
 * the run is created, because the event itself is kept 30 days and a run's
 * history longer.
 */
export interface RunCauseSummary {
  /** "Pull request opened", "Label added · bug", "Schedule", "Manual run". */
  label: string;
  /** A sentence under the label: the PR's title, "Daily run", "Started from the automation page". */
  text: string;
  /** `acme/xrp-mobile#124`, a short sha, a tag. */
  ref?: string;
  actor?: string;
  url?: string;
  /** The catalog event type, or `schedule` / `manual`. */
  eventType: string;
}

export interface AutomationRunProps {
  organizationId: string;
  automationId: string;
  revisionId: string;
  triggerId: string | null;
  cause: AutomationRunCause;
  /** What makes a firing unique: a delivery, a schedule slot, a Run now request. */
  causeKey: string;
  causeSummary: RunCauseSummary;
  inboundEventId: string | null;
  scheduledFor: Date | null;
  outcome: AutomationRunOutcome;
  skipReason: AutomationSkipReason | null;
  /** When the dispatcher may next look at it: now, or later for a deferral. */
  availableAt: Date;
  attempts: number;
  sessionId: string | null;
  requestedByUserId: string | null;
  dispatchedAt: Date | null;
}

export type NewRunProps = Omit<
  AutomationRunProps,
  'outcome' | 'skipReason' | 'availableAt' | 'attempts' | 'sessionId' | 'dispatchedAt'
>;

/**
 * One firing of an automation, and what became of it before a session existed
 * (§Q4). Once it is dispatched, how the run goes is the session's turn to say;
 * this aggregate only ever records why it happened and what the guards decided.
 */
export class AutomationRunEntity extends AggregateRoot<AutomationRunProps> {
  static create(create: CreateEntityProps<AutomationRunProps>): AutomationRunEntity {
    return new AutomationRunEntity(create);
  }

  /** A firing the dispatcher owes a look at. */
  static fire(props: NewRunProps, now: Date): AutomationRunEntity {
    const run = new AutomationRunEntity({
      id: randomUUID(),
      props: {
        ...props,
        outcome: 'pending',
        skipReason: null,
        availableAt: now,
        attempts: 0,
        sessionId: null,
        dispatchedAt: null,
      },
    });
    run.changed('the automation fired');
    return run;
  }

  /** A firing a guard refused before it was ever queued. Recorded, never silent. */
  static skipped(props: NewRunProps, reason: AutomationSkipReason, now: Date): AutomationRunEntity {
    const run = AutomationRunEntity.fire(props, now);
    run.skip(reason);
    return run;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get automationId(): string {
    return this.props.automationId;
  }
  get revisionId(): string {
    return this.props.revisionId;
  }
  get triggerId(): string | null {
    return this.props.triggerId;
  }
  get cause(): AutomationRunCause {
    return this.props.cause;
  }
  get causeKey(): string {
    return this.props.causeKey;
  }
  get causeSummary(): RunCauseSummary {
    return this.props.causeSummary;
  }
  get inboundEventId(): string | null {
    return this.props.inboundEventId;
  }
  get scheduledFor(): Date | null {
    return this.props.scheduledFor;
  }
  get outcome(): AutomationRunOutcome {
    return this.props.outcome;
  }
  get skipReason(): AutomationSkipReason | null {
    return this.props.skipReason;
  }
  get availableAt(): Date {
    return this.props.availableAt;
  }
  get attempts(): number {
    return this.props.attempts;
  }
  get sessionId(): string | null {
    return this.props.sessionId;
  }
  get requestedByUserId(): string | null {
    return this.props.requestedByUserId;
  }
  get dispatchedAt(): Date | null {
    return this.props.dispatchedAt;
  }
  get isPending(): boolean {
    return this.props.outcome === 'pending';
  }

  skip(reason: AutomationSkipReason): void {
    this.assertPending();
    this.props.outcome = 'skipped';
    this.props.skipReason = reason;
    this.setUpdatedAt(new Date());
    this.changed(`the run was skipped: ${reason}`);
  }

  expire(): void {
    this.assertPending();
    this.props.outcome = 'expired';
    this.setUpdatedAt(new Date());
    this.changed('the run expired before it could start');
  }

  /** Not now: look again at `until`. Counts as an attempt. */
  defer(until: Date): void {
    this.assertPending();
    this.props.availableAt = until;
    this.props.attempts += 1;
    this.setUpdatedAt(new Date());
    this.changed('the run was deferred');
  }

  /**
   * The session exists. `revisionId` is the revision it was launched with —
   * the current one at dispatch, which is what actually ran.
   */
  dispatched(sessionId: string, revisionId: string, at: Date): void {
    this.assertPending();
    this.props.revisionId = revisionId;
    this.props.outcome = 'dispatched';
    this.props.sessionId = sessionId;
    this.props.dispatchedAt = at;
    this.setUpdatedAt(new Date());
    this.changed('the run started its session');
  }

  /** One per write, however many steps it took (`skipped` fires, then skips). */
  private changed(reason: string): void {
    if (this.domainEvents.some((event) => event instanceof AutomationRunChangedDomainEvent)) return;
    this.addEvent(
      new AutomationRunChangedDomainEvent({
        aggregateId: this.id,
        reason,
        organizationId: this.props.organizationId,
        automationId: this.props.automationId,
      }),
    );
  }

  private assertPending(): void {
    if (this.props.outcome !== 'pending') {
      throw new ArgumentInvalidException(`Run ${this.id} is already ${this.props.outcome}`);
    }
  }

  public validate(): void {
    if (!this.props.causeKey) throw new ArgumentInvalidException('A run needs a cause key');
  }
}
