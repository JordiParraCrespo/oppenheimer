import { describe, expect, it } from 'vitest';
import { compareRank, GoalEntity, TaskEntity } from '../task.entity';

const task = (
  overrides: Partial<{
    status: TaskEntity['status'];
    rank: string;
    dueDate: string | null;
    sessions: TaskEntity['sessions'];
  }>,
) =>
  new TaskEntity(
    't',
    'p',
    null,
    overrides.status ?? 'todo',
    overrides.rank ?? 'V',
    'Title',
    '',
    overrides.dueDate ?? null,
    null,
    null,
    overrides.sessions ?? [],
    new Date(),
    new Date(),
  );

/**
 * What the board reads off a task. A regression here shows a Done task as
 * overdue in red, orders a column by locale instead of by key, or sends the
 * card's session line to a session linked later instead of the one it started.
 */
describe('TaskEntity', () => {
  it('is overdue only while open and due before today', () => {
    expect(task({ dueDate: '2026-10-04' }).isOverdue('2026-10-05')).toBe(true);
    expect(task({ dueDate: '2026-10-05' }).isOverdue('2026-10-05')).toBe(false);
    expect(task({ dueDate: '2026-10-04', status: 'done' }).isOverdue('2026-10-05')).toBe(false);
  });

  it('orders a column byte by byte, as the API does', () => {
    const ranks = ['a', 'Z', 'V0', 'V'].map((rank) => task({ rank }));
    expect(ranks.sort(compareRank).map((t) => t.rank)).toEqual(['V', 'V0', 'Z', 'a']);
  });

  it('leads with the session it started, else the latest linked', () => {
    const linked = { sessionId: 'l', origin: 'linked' as const, linkedAt: new Date() };
    const started = { sessionId: 's', origin: 'started' as const, linkedAt: new Date() };
    expect(task({ sessions: [linked, started] }).primarySessionId).toBe('s');
    expect(task({ sessions: [linked] }).primarySessionId).toBe('l');
    expect(task({}).primarySessionId).toBeNull();
  });
});

describe('GoalEntity', () => {
  it('is complete only when it has tasks and all are done', () => {
    expect(new GoalEntity('g', 'p', 'G', null, 0, 0, new Date()).isComplete).toBe(false);
    expect(new GoalEntity('g', 'p', 'G', null, 1, 4, new Date()).percent).toBe(25);
    expect(new GoalEntity('g', 'p', 'G', null, 2, 2, new Date()).isComplete).toBe(true);
  });
});
