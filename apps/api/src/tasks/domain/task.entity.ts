import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  TASK_NOTES_MAX,
  TASK_STATUSES_BEFORE_WORK,
  TASK_TITLE_MAX,
  type TaskStatus,
} from '@oppenheimer/shared';
import { TaskSessionLinkedDomainEvent } from './events/task-session-linked.domain-event';
import { isRank } from './task-rank.policy';

/** How a session came to be on a task: started from it, or linked afterwards. */
export type TaskSessionOrigin = 'started' | 'linked';

export interface TaskSessionLink {
  sessionId: string;
  origin: TaskSessionOrigin;
  linkedByUserId: string | null;
  linkedAt: Date;
}

export interface TaskProps {
  /** Immutable: a task never moves workspace. */
  organizationId: string;
  /** Always set; a task with no project is filed under the Unassigned one. */
  projectId: string;
  /** One of the project's goals, or none. The database refuses a goal of another project. */
  goalId: string | null;
  status: TaskStatus;
  /** Its place in the column (`task-rank.policy.ts`); empty until the repository places it. */
  rank: string;
  title: string;
  notes: string;
  /** A calendar day, `YYYY-MM-DD`, read in the viewer's timezone. */
  dueDate: string | null;
  /** `HH:MM`; only with a due date. */
  dueTime: string | null;
  /** When it last moved to Done; cleared when it leaves. */
  completedAt: Date | null;
  createdByUserId: string | null;
  /** The sessions on the task, oldest first. */
  sessions: TaskSessionLink[];
}

export interface CreateTaskProps {
  organizationId: string;
  projectId: string;
  goalId: string | null;
  status: TaskStatus;
  title: string;
  notes?: string;
  dueDate?: string | null;
  dueTime?: string | null;
  createdByUserId: string;
}

/** What a person may change on the task itself; absent leaves a field, `null` clears it. */
export interface TaskEdit {
  title?: string;
  notes?: string;
  dueDate?: string | null;
  dueTime?: string | null;
}

/**
 * A task on Plan's board (`product/versions/mvp/18-plan-product.md`): work a person
 * asks for, in one of four columns, under a project and maybe one of its goals. It
 * starts sessions or links existing ones, and attaching one is the only thing that
 * moves it on its own (§4).
 */
export class TaskEntity extends AggregateRoot<TaskProps> {
  static create(create: CreateEntityProps<TaskProps>): TaskEntity {
    return new TaskEntity(create);
  }

  static createNew(props: CreateTaskProps): TaskEntity {
    const task = new TaskEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        projectId: props.projectId,
        goalId: props.goalId,
        status: props.status,
        rank: '',
        title: props.title.trim(),
        notes: props.notes ?? '',
        dueDate: props.dueDate ?? null,
        dueTime: props.dueDate ? (props.dueTime ?? null) : null,
        completedAt: props.status === 'done' ? new Date() : null,
        createdByUserId: props.createdByUserId,
        sessions: [],
      },
    });
    task.validate();
    return task;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get projectId(): string {
    return this.props.projectId;
  }
  get goalId(): string | null {
    return this.props.goalId;
  }
  get status(): TaskStatus {
    return this.props.status;
  }
  get rank(): string {
    return this.props.rank;
  }
  get title(): string {
    return this.props.title;
  }
  get notes(): string {
    return this.props.notes;
  }
  get dueDate(): string | null {
    return this.props.dueDate;
  }
  get dueTime(): string | null {
    return this.props.dueTime;
  }
  get completedAt(): Date | null {
    return this.props.completedAt;
  }
  get createdByUserId(): string | null {
    return this.props.createdByUserId;
  }
  /** A copy: links change through {@link attach} and the repository's unlink. */
  get sessions(): TaskSessionLink[] {
    return this.props.sessions.map((link) => ({ ...link }));
  }

  edit(changes: TaskEdit): void {
    if (changes.title !== undefined) this.props.title = changes.title.trim();
    if (changes.notes !== undefined) this.props.notes = changes.notes;
    if (changes.dueDate !== undefined) {
      this.props.dueDate = changes.dueDate;
      // A time without its day would be a time of no day in particular.
      if (changes.dueDate === null) this.props.dueTime = null;
    }
    if (changes.dueTime !== undefined) this.props.dueTime = changes.dueTime;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  /** File under a project and one of its goals, or none. The caller resolved both. */
  file(projectId: string, goalId: string | null): void {
    this.props.projectId = projectId;
    this.props.goalId = goalId;
    this.setUpdatedAt(new Date());
  }

  /** Put the task in a column at a key the repository chose. */
  place(status: TaskStatus, rank: string, now: Date): void {
    if (status === 'done' && this.props.status !== 'done') this.props.completedAt = now;
    if (status !== 'done') this.props.completedAt = null;
    this.props.status = status;
    this.props.rank = rank;
    this.setUpdatedAt(now);
    this.validate();
  }

  /**
   * The attach rule, shared by Start and Link existing: a session moves a task that
   * has not started to In progress, but only while it is still where the person saw
   * it when they clicked. A drag made after the click wins.
   */
  startsWorkOnAttach(seenStatus: TaskStatus): boolean {
    return TASK_STATUSES_BEFORE_WORK.includes(seenStatus) && this.props.status === seenStatus;
  }

  /** Record a session on the task. Linking one twice records it once. */
  attach(link: TaskSessionLink): void {
    if (this.props.sessions.some((existing) => existing.sessionId === link.sessionId)) return;
    this.props.sessions.push({ ...link });
    this.addEvent(
      new TaskSessionLinkedDomainEvent({
        aggregateId: this.id,
        organizationId: this.props.organizationId,
        sessionId: link.sessionId,
        origin: link.origin,
        reason: 'A session was attached to a task',
      }),
    );
  }

  public validate(): void {
    if (!this.props.organizationId) {
      throw new ArgumentNotProvidedException('A task must belong to an organization');
    }
    if (!this.props.projectId) {
      throw new ArgumentNotProvidedException('A task is always filed under a project');
    }
    if (!this.props.title || this.props.title.length > TASK_TITLE_MAX) {
      throw new ArgumentInvalidException(`A task's title is 1 to ${TASK_TITLE_MAX} characters`);
    }
    if (this.props.notes.length > TASK_NOTES_MAX) {
      throw new ArgumentInvalidException(`A task's notes are at most ${TASK_NOTES_MAX} characters`);
    }
    if (this.props.dueTime && !this.props.dueDate) {
      throw new ArgumentInvalidException('A due time needs a due date');
    }
    if (this.props.rank && !isRank(this.props.rank)) {
      throw new ArgumentInvalidException('A task rank is a fractional key');
    }
  }
}
