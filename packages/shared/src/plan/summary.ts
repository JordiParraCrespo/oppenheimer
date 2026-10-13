import type { TaskStatus } from '../schemas/task.schema.js';

/**
 * Where each project stands, from its tasks and milestones: the facts a
 * project's overview draws and an agent answers from
 * (`product/versions/mvp/23-plan-milestones-stats-accounts.md` §3). One pure
 * function so the console and the API cannot compute them two ways.
 *
 * `today` is the viewer's calendar day, `YYYY-MM-DD`, always passed in: what
 * is overdue depends on where the person is, never on a server's clock.
 */

export interface PlanSummaryTask {
  id: string;
  projectId: string;
  milestoneId: string | null;
  status: TaskStatus;
  title: string;
  dueDate: string | null;
  blockedReason: string | null;
}

export interface PlanSummaryMilestone {
  id: string;
  projectId: string;
  name: string;
  targetDate: string | null;
}

/** A task that waits on a person: marked blocked, or past its due date. Blocked wins. */
export interface PlanNeedsInput {
  taskId: string;
  title: string;
  reason: 'blocked' | 'overdue';
  /** The blocked reason, or the due date it is overdue since. */
  detail: string;
}

export interface PlanTaskRef {
  taskId: string;
  title: string;
  dueDate: string | null;
}

export interface MilestoneSummary {
  milestoneId: string;
  name: string;
  targetDate: string | null;
  done: number;
  total: number;
  /** It has tasks and every one is done. */
  completed: boolean;
}

/**
 * The project's state as one word: something needs a person, work is under
 * way, everything is done, work waits to start, or there is nothing yet.
 */
export type ProjectPlanStatus = 'needs_input' | 'in_progress' | 'completed' | 'queued' | 'idle';

export interface ProjectPlanSummary {
  projectId: string;
  done: number;
  total: number;
  doing: PlanTaskRef[];
  needsInput: PlanNeedsInput[];
  /** The open task due soonest, overdue ones included. */
  nextDue: PlanTaskRef | null;
  /** The open milestone with the nearest target date. */
  nextMilestone: MilestoneSummary | null;
  milestones: MilestoneSummary[];
  status: ProjectPlanStatus;
}

export interface PlanTotals {
  done: number;
  total: number;
  doing: number;
  needsInput: number;
  milestones: number;
  milestonesCompleted: number;
}

const byDate = (a: string | null, b: string | null): number =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1;

/** One summary per project that has a task or a milestone, in the order they first appear. */
export function summarizePlan(
  tasks: readonly PlanSummaryTask[],
  milestones: readonly PlanSummaryMilestone[],
  today: string,
): ProjectPlanSummary[] {
  const projectIds: string[] = [];
  const seen = new Set<string>();
  for (const { projectId } of [...tasks, ...milestones]) {
    if (seen.has(projectId)) continue;
    seen.add(projectId);
    projectIds.push(projectId);
  }

  return projectIds.map((projectId) => {
    const own = tasks.filter((task) => task.projectId === projectId);
    const open = own.filter((task) => task.status !== 'done');
    const ref = (task: PlanSummaryTask): PlanTaskRef => ({
      taskId: task.id,
      title: task.title,
      dueDate: task.dueDate,
    });

    const needsInput: PlanNeedsInput[] = [];
    for (const task of open) {
      if (task.blockedReason) {
        needsInput.push({
          taskId: task.id,
          title: task.title,
          reason: 'blocked',
          detail: task.blockedReason,
        });
      } else if (task.dueDate !== null && task.dueDate < today) {
        needsInput.push({
          taskId: task.id,
          title: task.title,
          reason: 'overdue',
          detail: task.dueDate,
        });
      }
    }

    const milestoneSummaries = milestones
      .filter((milestone) => milestone.projectId === projectId)
      .map((milestone): MilestoneSummary => {
        const grouped = own.filter((task) => task.milestoneId === milestone.id);
        const done = grouped.filter((task) => task.status === 'done').length;
        return {
          milestoneId: milestone.id,
          name: milestone.name,
          targetDate: milestone.targetDate,
          done,
          total: grouped.length,
          completed: grouped.length > 0 && done === grouped.length,
        };
      });

    const nextDue =
      open
        .filter((task) => task.dueDate !== null)
        .sort((a, b) => byDate(a.dueDate, b.dueDate))
        .map(ref)[0] ?? null;
    const nextMilestone =
      milestoneSummaries
        .filter((milestone) => !milestone.completed && milestone.targetDate !== null)
        .sort((a, b) => byDate(a.targetDate, b.targetDate))[0] ?? null;

    const done = own.length - open.length;
    const doing = own.filter((task) => task.status === 'doing').map(ref);
    const status: ProjectPlanStatus =
      needsInput.length > 0
        ? 'needs_input'
        : doing.length > 0
          ? 'in_progress'
          : own.length > 0 && done === own.length
            ? 'completed'
            : own.length > 0
              ? 'queued'
              : 'idle';

    return {
      projectId,
      done,
      total: own.length,
      doing,
      needsInput,
      nextDue,
      nextMilestone,
      milestones: milestoneSummaries,
      status,
    };
  });
}

/** The workspace's totals over every project's summary. */
export function totalPlan(summaries: readonly ProjectPlanSummary[]): PlanTotals {
  return summaries.reduce<PlanTotals>(
    (totals, project) => ({
      done: totals.done + project.done,
      total: totals.total + project.total,
      doing: totals.doing + project.doing.length,
      needsInput: totals.needsInput + project.needsInput.length,
      milestones: totals.milestones + project.milestones.length,
      milestonesCompleted:
        totals.milestonesCompleted + project.milestones.filter((m) => m.completed).length,
    }),
    { done: 0, total: 0, doing: 0, needsInput: 0, milestones: 0, milestonesCompleted: 0 },
  );
}
