import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  type PlanTaskEventKind,
  TASK_BLOCKED_REASON_MAX,
  TASK_NOTES_MAX,
  TASK_STATUSES_BEFORE_WORK,
  TASK_TITLE_MAX,
  type TaskStatus,
} from '@oppenheimer/shared';
import { TaskChangedDomainEvent } from './events/task-changed.domain-event';
import { TaskSessionLinkedDomainEvent } from './events/task-session-linked.domain-event';
import type { PlanActor, PlanChange, PlanWriteKind } from './plan-change.types';
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
  /** One of the project's milestones, or none. The database refuses a milestone of another project. */
  milestoneId: string | null;
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
  /** Why it waits on a person, or null; Done clears it. */
  blockedReason: string | null;
  blockedAt: Date | null;
  /** Goes up on every write; this is the one it was read at. */
  version: number;
  /** The `Idempotency-Key` of the create that made it. */
  idempotencyKey: string | null;
  createdByUserId: string | null;
  /** The sessions on the task, oldest first. */
  sessions: TaskSessionLink[];
}

export interface CreateTaskProps {
  organizationId: string;
  projectId: string;
  milestoneId: string | null;
  status: TaskStatus;
  title: string;
  notes?: string;
  dueDate?: string | null;
  dueTime?: string | null;
  createdByUserId: string;
  actor: PlanActor;
  idempotencyKey?: string | null;
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
 * asks for, in one of four columns, under a project and maybe one of its milestones. It
 * starts sessions or links existing ones, and attaching one is the only thing that
 * moves it on its own (§4).
 */
export class TaskEntity extends AggregateRoot<TaskProps> {
  private actor: PlanActor | null = null;
  private expected: number | null = null;
  private changes: PlanChange[] = [];
  /** The column before this write's first placement, so a retried placement logs once. */
  private statusAtFirstPlace: TaskStatus | null = null;
  private placeChange: PlanChange | null = null;

  static create(create: CreateEntityProps<TaskProps>): TaskEntity {
    return new TaskEntity(create);
  }

  static createNew(props: CreateTaskProps): TaskEntity {
    const task = new TaskEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        projectId: props.projectId,
        milestoneId: props.milestoneId,
        status: props.status,
        rank: '',
        title: props.title.trim(),
        notes: props.notes ?? '',
        dueDate: props.dueDate ?? null,
        dueTime: props.dueDate ? (props.dueTime ?? null) : null,
        completedAt: props.status === 'done' ? new Date() : null,
        blockedReason: null,
        blockedAt: null,
        version: 1,
        idempotencyKey: props.idempotencyKey ?? null,
        createdByUserId: props.createdByUserId,
        sessions: [],
      },
    });
    task.validate();
    task.actingAs(props.actor);
    task.record('created', {});
    if (props.status === 'done') task.record('completed', {});
    task.touched('created');
    return task;
  }

  /** Who the changes that follow are by. Every write names one. */
  actingAs(actor: PlanActor): this {
    this.actor = actor;
    return this;
  }

  /**
   * The version the writer read, when it names one: the write then lands only
   * while the row still holds it (`TASKS_008` otherwise).
   */
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
  get milestoneId(): string | null {
    return this.props.milestoneId;
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
  get blockedReason(): string | null {
    return this.props.blockedReason;
  }
  get blockedAt(): Date | null {
    return this.props.blockedAt;
  }
  get version(): number {
    return this.props.version;
  }
  get idempotencyKey(): string | null {
    return this.props.idempotencyKey;
  }
  get createdByUserId(): string | null {
    return this.props.createdByUserId;
  }
  /** A copy: links change through {@link attach} and the repository's unlink. */
  get sessions(): TaskSessionLink[] {
    return this.props.sessions.map((link) => ({ ...link }));
  }

  edit(changes: TaskEdit): void {
    const due = { dueDate: this.props.dueDate, dueTime: this.props.dueTime };
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
    if (due.dueDate !== this.props.dueDate || due.dueTime !== this.props.dueTime) {
      this.record('rescheduled', {
        from: due,
        to: { dueDate: this.props.dueDate, dueTime: this.props.dueTime },
      });
    }
    this.touched('updated');
  }

  /** File under a project and one of its milestones, or none. The caller resolved both. */
  file(projectId: string, milestoneId: string | null): void {
    const from = { projectId: this.props.projectId, milestoneId: this.props.milestoneId };
    this.props.projectId = projectId;
    this.props.milestoneId = milestoneId;
    this.setUpdatedAt(new Date());
    if (from.projectId !== projectId || from.milestoneId !== milestoneId) {
      this.record('reassigned', { from, to: { projectId, milestoneId } });
    }
    this.touched('updated');
  }

  /**
   * Mark the task blocked and say why, or unblock it with `null`. A Done task
   * is not blocked: there is nothing left to wait for.
   */
  block(reason: string | null, now = new Date()): void {
    const next = reason === null || this.props.status === 'done' ? null : reason.trim();
    const previous = this.props.blockedReason;
    if (next === previous) return;
    this.props.blockedReason = next;
    this.props.blockedAt = next === null ? null : now;
    this.setUpdatedAt(now);
    this.validate();
    this.record(next === null ? 'unblocked' : 'blocked', next === null ? {} : { reason: next });
    this.touched('updated');
  }

  /**
   * Put the task in a column at a key the repository chose. Into Done it is
   * completed and unblocked; out of Done, reopened; between the other columns
   * the status change is logged. A reorder within a column logs nothing.
   */
  place(status: TaskStatus, rank: string, now: Date): void {
    this.statusAtFirstPlace ??= this.props.status;
    const from = this.statusAtFirstPlace;
    this.syncPlace(status, rank, now);
    if (status === 'done') {
      this.props.blockedReason = null;
      this.props.blockedAt = null;
    }
    // A placement retried after losing a rank race replaces the change it logged.
    if (this.placeChange) this.changes = this.changes.filter((c) => c !== this.placeChange);
    this.placeChange = null;
    if (from !== status) {
      if (status === 'done') this.record('completed', { from });
      else if (from === 'done') this.record('reopened', { to: status });
      else this.record('status_changed', { from, to: status });
      this.placeChange = this.changes[this.changes.length - 1] ?? null;
    }
    this.touched(this.isNew ? 'created' : 'updated');
  }

  /**
   * Take the place the row holds now, read under a lock: a correction of what
   * this instance was loaded with, not a change of its own, so nothing is logged.
   */
  syncPlace(status: TaskStatus, rank: string, now: Date): void {
    if (status === 'done' && this.props.status !== 'done') this.props.completedAt = now;
    if (status !== 'done') this.props.completedAt = null;
    this.props.status = status;
    this.props.rank = rank;
    this.setUpdatedAt(now);
    this.validate();
  }

  /** Take a session off the task; the repository removes the link. */
  detach(): void {
    this.touched('updated');
  }

  /** The task is being deleted. Its sessions are their own and stay. */
  remove(): void {
    this.record('deleted', {});
    this.touched('deleted');
  }

  private get isNew(): boolean {
    return this.domainEvents.some(
      (event) => event instanceof TaskChangedDomainEvent && event.change === 'created',
    );
  }

  private record(kind: PlanTaskEventKind, payload: Record<string, unknown>): void {
    if (!this.actor) {
      throw new ArgumentNotProvidedException('A change to a task names who made it');
    }
    this.changes.push({
      kind,
      projectId: this.props.projectId,
      milestoneId: this.props.milestoneId,
      actor: this.actor,
      payload,
      occurredAt: new Date(),
    });
  }

  /** One change event per write, however many fields it touched. */
  private touched(change: PlanWriteKind): void {
    const pending = this.domainEvents.find(
      (event): event is TaskChangedDomainEvent => event instanceof TaskChangedDomainEvent,
    );
    if (pending && (pending.change === 'created' || pending.change === change)) return;
    this.addEvent(
      new TaskChangedDomainEvent({
        aggregateId: this.id,
        organizationId: this.props.organizationId,
        change,
        reason: `A task was ${change}`,
      }),
    );
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
    this.record('session_linked', { sessionId: link.sessionId, origin: link.origin });
    this.touched('updated');
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
    if (
      this.props.blockedReason !== null &&
      this.props.blockedReason.length > TASK_BLOCKED_REASON_MAX
    ) {
      throw new ArgumentInvalidException(
        `A blocked reason is at most ${TASK_BLOCKED_REASON_MAX} characters`,
      );
    }
    if (this.props.rank && !isRank(this.props.rank)) {
      throw new ArgumentInvalidException('A task rank is a fractional key');
    }
  }
}
