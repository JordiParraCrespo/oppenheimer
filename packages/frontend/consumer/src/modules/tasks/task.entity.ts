import type { TaskStatus } from '@oppenheimer/shared/schemas/task';

/** A session on a task: started from it, or linked afterwards. */
export interface TaskSessionLink {
  sessionId: string;
  origin: 'started' | 'linked';
  linkedAt: Date;
}

/**
 * A task on Plan's board (`product/versions/mvp/18-plan-product.md`): work a person
 * asks for, in one of four columns, under a project and maybe one of its goals.
 * Due dates are calendar days (`YYYY-MM-DD`) read in the viewer's timezone, so the
 * caller says what today is.
 */
export class TaskEntity {
  constructor(
    public readonly id: string,
    public readonly projectId: string,
    public readonly goalId: string | null,
    public readonly status: TaskStatus,
    /** Its place in the column; compare byte by byte with {@link compareRank}. */
    public readonly rank: string,
    public readonly title: string,
    public readonly notes: string,
    public readonly dueDate: string | null,
    public readonly dueTime: string | null,
    public readonly completedAt: Date | null,
    public readonly sessions: TaskSessionLink[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  get isDone(): boolean {
    return this.status === 'done';
  }

  /** Open and due before `today` (`YYYY-MM-DD`, the viewer's). */
  isOverdue(today: string): boolean {
    return !this.isDone && this.dueDate !== null && this.dueDate < today;
  }

  /** The session the card links to when it has several: the one that started it, else the latest. */
  get primarySessionId(): string | null {
    const started = this.sessions.find((link) => link.origin === 'started');
    return started?.sessionId ?? this.sessions.at(-1)?.sessionId ?? null;
  }
}

/** The board's order: byte order of the rank, as the API sorts it. */
export function compareRank(a: TaskEntity, b: TaskEntity): number {
  return a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0;
}

/** A goal over a project's tasks, with how far it is. */
export class GoalEntity {
  constructor(
    public readonly id: string,
    public readonly projectId: string,
    public readonly name: string,
    public readonly targetDate: string | null,
    public readonly doneCount: number,
    public readonly totalCount: number,
    public readonly createdAt: Date,
  ) {}

  /** 0 to 100; a goal with no tasks is at 0. */
  get percent(): number {
    return this.totalCount ? Math.round((this.doneCount / this.totalCount) * 100) : 0;
  }

  get isComplete(): boolean {
    return this.totalCount > 0 && this.doneCount === this.totalCount;
  }
}

/** What the task dialog and the inline composer send. */
export interface TaskInput {
  title: string;
  notes?: string;
  status?: TaskStatus;
  projectId?: string;
  goalId?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
}

/** A column change: first when `afterTaskId` is null, else directly after that task. */
export interface TaskMove {
  status: TaskStatus;
  afterTaskId: string | null;
}

export interface GoalInput {
  name: string;
  projectId: string;
  targetDate?: string | null;
}

/** Narrows the board: one filter or none. */
export interface TaskFilter {
  projectId?: string;
  goalId?: string;
  sessionId?: string;
  dueFrom?: string;
  dueTo?: string;
}
