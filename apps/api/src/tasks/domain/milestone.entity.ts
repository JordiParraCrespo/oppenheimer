import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { MILESTONE_NAME_MAX } from '@oppenheimer/shared';

export interface MilestoneProps {
  organizationId: string;
  /** A milestone is what one project is aiming for; it always has one. */
  projectId: string;
  name: string;
  /** A calendar day, `YYYY-MM-DD`. */
  targetDate: string | null;
  createdByUserId: string | null;
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
  static create(create: CreateEntityProps<MilestoneProps>): MilestoneEntity {
    return new MilestoneEntity(create);
  }

  static createNew(props: Omit<MilestoneProps, 'createdByUserId'> & { createdByUserId: string }) {
    const milestone = new MilestoneEntity({
      id: randomUUID(),
      props: { ...props, name: props.name.trim() },
    });
    milestone.validate();
    return milestone;
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

  edit(changes: MilestoneEdit): void {
    if (changes.name !== undefined) this.props.name = changes.name.trim();
    if (changes.projectId !== undefined) this.props.projectId = changes.projectId;
    if (changes.targetDate !== undefined) this.props.targetDate = changes.targetDate;
    this.setUpdatedAt(new Date());
    this.validate();
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
