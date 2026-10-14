import { describe, expect, it } from 'vitest';
import { type PlanSummaryTask, summarizePlan, totalPlan } from '../summary.js';

const task = (over: Partial<PlanSummaryTask> & Pick<PlanSummaryTask, 'id'>): PlanSummaryTask => ({
  projectId: 'p1',
  milestoneId: null,
  status: 'todo',
  title: over.id,
  dueDate: null,
  blockedReason: null,
  ...over,
});

describe('summarizePlan', () => {
  it('says a project needs input for a blocked task and for one past its due date, blocked first', () => {
    const [summary] = summarizePlan(
      [
        task({ id: 'late', dueDate: '2026-10-12' }),
        task({ id: 'stuck', dueDate: '2026-10-01', blockedReason: 'Waiting on keys' }),
        task({ id: 'today', dueDate: '2026-10-13' }),
        task({ id: 'shipped', status: 'done', dueDate: '2026-09-01' }),
      ],
      [],
      '2026-10-13',
    );
    expect(summary.needsInput).toEqual([
      { taskId: 'late', title: 'late', reason: 'overdue', detail: '2026-10-12' },
      { taskId: 'stuck', title: 'stuck', reason: 'blocked', detail: 'Waiting on keys' },
    ]);
    expect(summary.status).toBe('needs_input');
    expect(summary.nextDue?.taskId).toBe('stuck');
  });

  it('decides overdue on the day it is given, not on a clock', () => {
    const tasks = [task({ id: 't', dueDate: '2026-10-13' })];
    expect(summarizePlan(tasks, [], '2026-10-13')[0].needsInput).toEqual([]);
    expect(summarizePlan(tasks, [], '2026-10-14')[0].needsInput).toHaveLength(1);
  });

  it('counts a milestone complete only when it has tasks and all are done, and picks the nearest open one', () => {
    const [summary] = summarizePlan(
      [
        task({ id: 'a', milestoneId: 'm1', status: 'done' }),
        task({ id: 'b', milestoneId: 'm2', status: 'done' }),
        task({ id: 'c', milestoneId: 'm2' }),
      ],
      [
        { id: 'm1', projectId: 'p1', name: 'Alpha', targetDate: '2026-10-20' },
        { id: 'm2', projectId: 'p1', name: 'Beta', targetDate: '2026-11-01' },
        { id: 'm3', projectId: 'p1', name: 'Empty', targetDate: '2026-10-15' },
      ],
      '2026-10-13',
    );
    expect(summary.milestones.map((m) => [m.name, m.done, m.total, m.completed])).toEqual([
      ['Alpha', 1, 1, true],
      ['Beta', 1, 2, false],
      ['Empty', 0, 0, false],
    ]);
    expect(summary.nextMilestone?.name).toBe('Empty');
  });

  it('names a project’s state from its tasks', () => {
    const states = summarizePlan(
      [
        task({ id: 'a', projectId: 'doing', status: 'doing' }),
        task({ id: 'b', projectId: 'done', status: 'done' }),
        task({ id: 'c', projectId: 'queued' }),
      ],
      [{ id: 'm', projectId: 'idle', name: 'Later', targetDate: null }],
      '2026-10-13',
    ).map((s) => [s.projectId, s.status]);
    expect(states).toEqual([
      ['doing', 'in_progress'],
      ['done', 'completed'],
      ['queued', 'queued'],
      ['idle', 'idle'],
    ]);
  });

  it('totals the workspace over its projects', () => {
    const totals = totalPlan(
      summarizePlan(
        [
          task({ id: 'a', status: 'done', milestoneId: 'm' }),
          task({ id: 'b', projectId: 'p2', status: 'doing', blockedReason: 'x' }),
        ],
        [{ id: 'm', projectId: 'p1', name: 'M', targetDate: null }],
        '2026-10-13',
      ),
    );
    expect(totals).toEqual({
      done: 1,
      total: 2,
      doing: 1,
      needsInput: 1,
      milestones: 1,
      milestonesCompleted: 1,
    });
  });
});
