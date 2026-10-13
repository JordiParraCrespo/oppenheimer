import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { MILESTONE_NAME_MAX, type PlanMilestoneEventKind } from '@oppenheimer/shared';
import { MilestoneChangedDomainEvent } from './events/milestone-changed.domain-event';
import type { PlanActor, PlanChange, PlanWriteKind } from './plan-change.types';

export interface MilestoneProps {
  organizationId: string;
  /** A milestone is what one project is aiming for; it always has one. */
  projectId: string;
  name: string;
  /** A calendar day, `YYYY-MM-DD`. */
  targetDate: string | null;
  createdByUserId: string | null;
  /** Goes up on every write; this is the one it was read at. */
  version: number;
  idempotencyKey: string | null;
}

export interface CreateMilestoneProps {
  organizationId: string;
  projectId: string;
  name: string;
  targetDate: string | null;
  createdByUserId: string;
  actor: PlanActor;
  idempotencyKey?: string | null;
}

export interface MilestoneEdit {
  name?: string;
  projectId?: string;
  targetDate?: string | null;
}

/**
 * A milestone over a project's tasks (`product/versions/mvp/18-plan-product.md` §2–3).
 * It has no behaviour beyond grouping them: progress is a count of its tasks, read
 * by the query, never stored. Moving it to another project moves its tasks with
 * it, which the database does through the tasks' milestone key.
 */
export class MilestoneEntity extends AggregateRoot<MilestoneProps> {
  private actor: PlanActor | null = null;
  private expected: number | null = null;
  private changes: PlanChange[] = [];

  static create(create: CreateEntityProps<MilestoneProps>): MilestoneEntity {
    return new MilestoneEntity(create);
  }

  static createNew(props: CreateMilestoneProps): MilestoneEntity {
    const milestone = new MilestoneEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        projectId: props.projectId,
        name: props.name.trim(),
        targetDate: props.targetDate,
        createdByUserId: props.createdByUserId,
        version: 1,
        idempotencyKey: props.idempotencyKey ?? null,
      },
    });
    milestone.validate();
    milestone.actingAs(props.actor);
    milestone.record('milestone_created', {});
    milestone.touched('created');
    return milestone;
  }

  /** Who the changes that follow are by. Every write names one. */
  actingAs(actor: PlanActor): this {
    this.actor = actor;
    return this;
  }

  /** The version the writer read, when it names one, as for a task. */
  expectVersion(version: number | null | undefined): this {
    this.expected = version ?? null;
    return this;
  }

  get expectedVersion(): number | null {
    return this.expected;
  }

  /**
   * The changes to log, oldest first. The repository writes them in the write's
   * transaction and clears them once it commits, so a retried transaction
   * writes them again.
   */
  get changesToLog(): readonly PlanChange[] {
    return this.changes;
  }

  clearChanges(): void {
    this.changes = [];
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get projectId(): string {
    return this.props.projectId;
  }
  get name(): string {
    return this.props.name;
  }
  get targetDate(): string | null {
    return this.props.targetDate;
  }
  get createdByUserId(): string | null {
    return this.props.createdByUserId;
  }
  get version(): number {
    return this.props.version;
  }
  get idempotencyKey(): string | null {
    return this.props.idempotencyKey;
  }

  edit(changes: MilestoneEdit): void {
    const before = { ...this.props };
    if (changes.name !== undefined) this.props.name = changes.name.trim();
    if (changes.projectId !== undefined) this.props.projectId = changes.projectId;
    if (changes.targetDate !== undefined) this.props.targetDate = changes.targetDate;
    this.setUpdatedAt(new Date());
    this.validate();
    if (before.name !== this.props.name) {
      this.record('milestone_renamed', { from: before.name, to: this.props.name });
    }
    if (before.targetDate !== this.props.targetDate) {
      this.record('milestone_retargeted', { from: before.targetDate, to: this.props.targetDate });
    }
    if (before.projectId !== this.props.projectId) {
      this.record('milestone_moved', { from: before.projectId, to: this.props.projectId });
    }
    this.touched('updated');
  }

  /** The milestone is being deleted; its tasks stay, with no milestone. */
  remove(): void {
    this.record('milestone_deleted', {});
    this.touched('deleted');
  }

  private record(kind: PlanMilestoneEventKind, payload: Record<string, unknown>): void {
    if (!this.actor) {
      throw new ArgumentNotProvidedException('A change to a milestone names who made it');
    }
    this.changes.push({
      kind,
      projectId: this.props.projectId,
      milestoneId: this.id,
      actor: this.actor,
      payload,
      occurredAt: new Date(),
    });
  }

  private touched(change: PlanWriteKind): void {
    if (this.domainEvents.some((event) => event instanceof MilestoneChangedDomainEvent)) return;
    this.addEvent(
      new MilestoneChangedDomainEvent({
        aggregateId: this.id,
        organizationId: this.props.organizationId,
        change,
        reason: `A milestone was ${change}`,
      }),
    );
  }

  public validate(): void {
    if (!this.props.organizationId || !this.props.projectId) {
      throw new ArgumentNotProvidedException('A milestone belongs to a project of an organization');
    }
    if (!this.props.name || this.props.name.length > MILESTONE_NAME_MAX) {
      throw new ArgumentInvalidException(
        `A milestone's name is 1 to ${MILESTONE_NAME_MAX} characters`,
      );
    }
  }
}
