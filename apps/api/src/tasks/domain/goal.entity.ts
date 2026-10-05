import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { GOAL_NAME_MAX } from '@oppenheimer/shared';

export interface GoalProps {
  organizationId: string;
  /** A goal is what one project is aiming for; it always has one. */
  projectId: string;
  name: string;
  /** A calendar day, `YYYY-MM-DD`. */
  targetDate: string | null;
  createdByUserId: string | null;
}

export interface GoalEdit {
  name?: string;
  projectId?: string;
  targetDate?: string | null;
}

/**
 * A goal over a project's tasks (`product/versions/mvp/18-plan-product.md` §2–3).
 * It has no behaviour beyond grouping them: progress is a count of its tasks, read
 * by the query, never stored. Moving it to another project moves its tasks with
 * it, which the database does through the tasks' goal key.
 */
export class GoalEntity extends AggregateRoot<GoalProps> {
  static create(create: CreateEntityProps<GoalProps>): GoalEntity {
    return new GoalEntity(create);
  }

  static createNew(props: Omit<GoalProps, 'createdByUserId'> & { createdByUserId: string }) {
    const goal = new GoalEntity({
      id: randomUUID(),
      props: { ...props, name: props.name.trim() },
    });
    goal.validate();
    return goal;
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

  edit(changes: GoalEdit): void {
    if (changes.name !== undefined) this.props.name = changes.name.trim();
    if (changes.projectId !== undefined) this.props.projectId = changes.projectId;
    if (changes.targetDate !== undefined) this.props.targetDate = changes.targetDate;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  public validate(): void {
    if (!this.props.organizationId || !this.props.projectId) {
      throw new ArgumentNotProvidedException('A goal belongs to a project of an organization');
    }
    if (!this.props.name || this.props.name.length > GOAL_NAME_MAX) {
      throw new ArgumentInvalidException(`A goal's name is 1 to ${GOAL_NAME_MAX} characters`);
    }
  }
}
