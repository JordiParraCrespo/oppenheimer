import type { TaskStatus } from '@oppenheimer/shared/schemas/task';

/** A session on a task: started from it, or linked afterwards. */
export interface TaskSessionLink {
  sessionId: string;
  origin: 'started' | 'linked';
  linkedAt: Date;
}

/**
 * A task on Plan's board (`product/versions/mvp/18-plan-product.md`): work a person
 * asks for, in one of four columns, under a project and maybe one of its milestones.
 * Due dates are calendar days (`YYYY-MM-DD`) read in the viewer's timezone, so the
 * caller says what today is.
 */
export class TaskEntity {
  constructor(
    public readonly id: string,
    public readonly projectId: string,
    public readonly milestoneId: string | null,
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
    /** Why it waits on a person, or null. Done clears it. */
    public readonly blockedReason: string | null = null,
    /** Goes up on every write, whoever made it. */
    public readonly version = 1,
  ) {}

  get isDone(): boolean {
    return this.status === 'done';
  }

  get isBlocked(): boolean {
    return !this.isDone && this.blockedReason !== null;
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

/** A milestone over a project's tasks, with how far it is. */
export class MilestoneEntity {
  constructor(
    public readonly id: string,
    public readonly projectId: string,
    public readonly name: string,
    public readonly targetDate: string | null,
    public readonly doneCount: number,
    public readonly totalCount: number,
    public readonly createdAt: Date,
  ) {}

  /** 0 to 100; a milestone with no tasks is at 0. */
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
  milestoneId?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  /** Marks the task blocked and says why; `null` unblocks it. */
  blockedReason?: string | null;
}

/** A column change: first when `afterTaskId` is null, else directly after that task. */
export interface TaskMove {
  status: TaskStatus;
  afterTaskId: string | null;
}

export interface MilestoneInput {
  name: string;
  projectId: string;
  targetDate?: string | null;
}

/** Narrows the board: one filter or none. */
export interface TaskFilter {
  projectId?: string;
  milestoneId?: string;
  sessionId?: string;
  dueFrom?: string;
  dueTo?: string;
}

/** A model's tokens over a Stats period. */
export interface PlanStatsModelTokens {
  model: string | null;
  total: number;
  byWeek: number[];
}

/** One period's headline numbers; null where a source is not measured. */
export interface PlanStatsTotals {
  tasksCompleted: number;
  tasksCreated: number;
  tokens: number | null;
  costUsd: number | null;
  pullRequestsMerged: number | null;
}

/**
 * Plan's Stats for a period (`GET /plan/stats`): every series follows `weeks`,
 * the Mondays the period touches in the viewer's zone.
 */
export interface PlanStats {
  from: string;
  to: string;
  weeks: string[];
  current: PlanStatsTotals & {
    completedByWeek: number[];
    createdByWeek: number[];
    tokensByModel: PlanStatsModelTokens[] | null;
    costByWeek: number[] | null;
  };
  previous: PlanStatsTotals | null;
  previousFrom: string | null;
  previousTo: string | null;
  projects: {
    projectId: string;
    tasksCompleted: number;
    tokens: number | null;
    costUsd: number | null;
  }[];
  /** `headless`: only turns that report usage are counted; `none`: nothing reported yet. */
  tokensMeasured: 'headless' | 'none';
}

/** What a Stats read asks for. `timeZone` is the viewer's IANA zone. */
export interface PlanStatsRequest {
  from: string;
  to: string;
  timeZone: string;
  projectId?: string;
  compare: boolean;
}
