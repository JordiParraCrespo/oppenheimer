import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import type { FlagCondition, FlagSegment } from '@oppenheimer/shared/feature-flags';
import {
  type FlagChangeAction,
  FlagConfigurationChangedDomainEvent,
} from './events/flag-configuration-changed.domain-event';
import type { FlagChange } from './feature-flag.entity';

export interface FlagSegmentProps {
  /** Stable, referenced by rules. Immutable. */
  key: string;
  name: string;
  description: string | null;
  conditions: FlagCondition[];
  updatedBy: string | null;
}

export interface CreateFlagSegmentProps {
  key: string;
  name: string;
  description?: string | null;
  conditions: FlagCondition[];
}

export interface UpdateFlagSegmentProps {
  name?: string;
  description?: string | null;
  conditions?: FlagCondition[];
}

/**
 * A named audience flags can target (`staff`, `beta-customers`).
 *
 * Where long ID lists live: written once here, referenced by key from any
 * number of rules, and changed in one place when the audience does. Stripe's
 * early flag records carried their ID lists inline, which is the version of
 * this that does not scale.
 */
export class FlagSegmentEntity extends AggregateRoot<FlagSegmentProps> {
  static create(create: CreateEntityProps<FlagSegmentProps>): FlagSegmentEntity {
    return new FlagSegmentEntity(create);
  }

  static createNew(props: CreateFlagSegmentProps, change: FlagChange): FlagSegmentEntity {
    const segment = new FlagSegmentEntity({
      id: randomUUID(),
      props: {
        key: props.key,
        name: props.name,
        description: props.description ?? null,
        conditions: props.conditions,
        updatedBy: change.actorId,
      },
    });
    segment.record('segment_created', change, null);
    return segment;
  }

  get key(): string {
    return this.props.key;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get conditions(): FlagCondition[] {
    return this.props.conditions;
  }

  get updatedBy(): string | null {
    return this.props.updatedBy;
  }

  toSegment(): FlagSegment {
    return { key: this.props.key, conditions: this.props.conditions };
  }

  update(props: UpdateFlagSegmentProps, change: FlagChange): void {
    const before = this.snapshot();
    if (props.name !== undefined) this.props.name = props.name;
    if (props.description !== undefined) this.props.description = props.description;
    if (props.conditions !== undefined) this.props.conditions = props.conditions;
    this.props.updatedBy = change.actorId;
    this.setUpdatedAt(new Date());
    this.validate();
    this.record('segment_updated', change, before);
  }

  /** Whether it is safe to delete is the handler's check: it needs the flags. */
  delete(change: FlagChange): void {
    this.addEvent(this.event('segment_deleted', change, this.snapshot(), null));
  }

  private snapshot(): Record<string, unknown> {
    return {
      name: this.props.name,
      description: this.props.description,
      conditions: this.props.conditions,
    };
  }

  private record(
    action: FlagChangeAction,
    change: FlagChange,
    before: Record<string, unknown> | null,
  ): void {
    this.addEvent(this.event(action, change, before, this.snapshot()));
  }

  private event(
    action: FlagChangeAction,
    change: FlagChange,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): FlagConfigurationChangedDomainEvent {
    return new FlagConfigurationChangedDomainEvent({
      aggregateId: this.id,
      subjectType: 'segment',
      subjectKey: this.props.key,
      action,
      actorId: change.actorId,
      comment: change.comment ?? null,
      before,
      after,
      reason: `Flag segment "${this.props.key}" changed; audit it and rebuild every replica's snapshot`,
    });
  }

  public validate(): void {
    if (!this.props.key?.trim()) {
      throw new ArgumentNotProvidedException('Segment key cannot be empty');
    }
    if (!this.props.name?.trim()) {
      throw new ArgumentNotProvidedException('Segment name cannot be empty');
    }
  }
}
