import { TaskEntity } from '@oppenheimer/frontend-consumer';
import type { TaskStatus } from '@oppenheimer/shared/schemas/task';
import { describe, expect, it } from 'vitest';
import {
  afterTaskIdFor,
  boardCounts,
  columnOf,
  doneCutoffOf,
  filingOf,
  splitDone,
} from '../lib/board';
import { boardSearchSchema } from '../lib/board-search';
import { cardView, dueDayLabel } from '../lib/card-view';
import { projectIdsOfSlugs, projectParamOf, projectSlugsOf } from '../lib/plan-scope';

function task(
  id: string,
  overrides: Partial<{
    status: TaskStatus;
    rank: string;
    projectId: string;
    milestoneId: string | null;
    dueDate: string | null;
    dueTime: string | null;
    completedAt: Date | null;
  }> = {},
) {
  return new TaskEntity(
    id,
    overrides.projectId ?? 'p-1',
    overrides.milestoneId ?? null,
    overrides.status ?? 'todo',
    overrides.rank ?? id,
    `Task ${id}`,
    '',
    overrides.dueDate ?? null,
    overrides.dueTime ?? null,
    overrides.completedAt !== undefined
      ? overrides.completedAt
      : overrides.status === 'done'
        ? new Date('2026-10-01T00:00:00Z')
        : null,
    [],
    new Date('2026-10-01T00:00:00Z'),
    new Date('2026-10-01T00:00:00Z'),
  );
}

/**
 * A column is its tasks in rank order, byte by byte as the API sorts them; a
 * drop lands after the card above it, so the server places it where the
 * reader let go even when the board is filtered.
 */
describe('the board', () => {
  const rows = [
    task('b', { rank: 'b' }),
    task('a', { rank: 'a' }),
    task('Z', { rank: 'Z' }),
    task('x', { status: 'done' }),
    task('o', { projectId: 'p-2', rank: 'aa' }),
  ];

  it('orders a column by byte order of the rank, as the API does', () => {
    // 'Z' < 'a' in byte order, whatever a locale compare says.
    expect(columnOf(rows, 'todo', {}).map((row) => row.id)).toEqual(['Z', 'a', 'o', 'b']);
  });

  it('narrows a column to the project and milestone it is filtered to', () => {
    expect(columnOf(rows, 'todo', { projectIds: ['p-2'] }).map((row) => row.id)).toEqual(['o']);
  });

  it('shows every project picked, not just the first', () => {
    // A filter that read only one id hid every other picked project's cards.
    const more = [...rows, task('q', { projectId: 'p-3', rank: 'ab' })];
    expect(columnOf(more, 'todo', { projectIds: ['p-2', 'p-3'] }).map((row) => row.id)).toEqual([
      'o',
      'q',
    ]);
  });

  it('drops a card after the one above it, or first', () => {
    const column = columnOf(rows, 'todo', { projectIds: ['p-1'] });
    expect(afterTaskIdFor(column, 0)).toBeNull();
    expect(afterTaskIdFor(column, 2)).toBe('a');
  });

  it('counts open, in progress, done and overdue on what the filter shows', () => {
    const board = [
      task('1', { dueDate: '2026-10-04' }),
      task('2', { status: 'doing', dueDate: '2026-10-09' }),
      task('3', { status: 'done', dueDate: '2026-09-01' }),
      task('4', { projectId: 'p-2', dueDate: '2026-10-01' }),
    ];
    expect(boardCounts(board, { projectIds: ['p-1'] }, '2026-10-05')).toEqual({
      open: 2,
      doing: 1,
      done: 1,
      overdue: 1,
    });
  });
});

describe('a card', () => {
  const context = {
    filter: {},
    today: '2026-10-05',
    projectName: () => 'Mobile',
    milestoneName: () => 'Ship 2.0',
    dayLabel: (iso: string) =>
      dueDayLabel(
        iso,
        '2026-10-05',
        { today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday' },
        (day) => day,
      ),
  };

  it('says when it is due, and how soon', () => {
    const view = cardView(
      task('1', { dueDate: '2026-10-06', dueTime: '09:00', milestoneId: 'g' }),
      context,
    );
    expect(view).toMatchObject({
      due: 'Tomorrow · 09:00',
      dueTone: 'soon',
      projectName: 'Mobile',
      milestoneName: 'Ship 2.0',
    });
    expect(cardView(task('2', { dueDate: '2026-10-01' }), context).dueTone).toBe('overdue');
    expect(cardView(task('3', { dueDate: '2026-10-20' }), context)).toMatchObject({
      due: '2026-10-20',
      dueTone: 'default',
    });
  });

  it('drops the due date once done, and the project and milestone the board is filtered to', () => {
    expect(cardView(task('1', { status: 'done', dueDate: '2026-10-01' }), context).due).toBeNull();
    const filtered = cardView(task('2', { milestoneId: 'g' }), {
      ...context,
      filter: { projectIds: ['p-1'], milestoneId: 'g' },
    });
    expect(filtered).toMatchObject({ projectName: null, milestoneName: null });
  });

  it('keeps the project on the card while several are picked', () => {
    const view = cardView(task('3'), { ...context, filter: { projectIds: ['p-1', 'p-2'] } });
    expect(view.projectName).toBe('Mobile');
  });
});

describe('boardSearchSchema', () => {
  it('reads an empty value as absent, so a bare /plan is All projects', () => {
    expect(boardSearchSchema.parse({ project: '', task: 'new', stray: 'x' })).toEqual({
      project: undefined,
      milestone: undefined,
      task: 'new',
      start: undefined,
      older: undefined,
    });
  });
});

/**
 * Done shows the past week and folds the rest under "Show older", so a
 * workspace's finished work stops burying the column (the board had 67).
 */
describe("Done's older tasks", () => {
  const done = (id: string, completedAt: Date | null, rank = id) =>
    task(id, { status: 'done', rank, completedAt });

  it('folds away what was finished before local midnight a week ago, keeping board order', () => {
    const cutoff = doneCutoffOf('2026-11-09');
    expect(cutoff).toEqual(new Date(2026, 10, 2));
    const column = [
      done('a', new Date(2026, 10, 9, 10)),
      done('b', new Date(2026, 9, 20)),
      done('c', new Date(2026, 10, 2, 0, 0)),
      done('d', new Date(2026, 10, 1, 23, 59)),
    ];
    const { recent, older } = splitDone(column, cutoff);
    expect(recent.map((row) => row.id)).toEqual(['a', 'c']);
    expect(older.map((row) => row.id)).toEqual(['b', 'd']);
  });

  it('keeps a done task with no completion time in view rather than hiding it', () => {
    const { recent } = splitDone([done('x', null)], doneCutoffOf('2026-11-09'));
    expect(recent.map((row) => row.id)).toEqual(['x']);
  });

  it('crosses a month boundary', () => {
    expect(doneCutoffOf('2026-03-03')).toEqual(new Date(2026, 1, 24));
  });
});

describe('filingOf', () => {
  const milestones = [{ id: 'm-1', projectId: 'p-2' }];

  it("files a task added under a milestone in the milestone's project, not Unassigned", () => {
    // With only a milestone filtered, sending Unassigned made the API refuse the task (TASK milestone/project mismatch).
    expect(filingOf({ milestoneId: 'm-1' }, milestones, 'p-unassigned')).toEqual({
      projectId: 'p-2',
      milestoneId: 'm-1',
    });
  });

  it('files in the first filtered project, else Unassigned, when no milestone is filtered', () => {
    expect(filingOf({ projectIds: ['p-3', 'p-4'] }, milestones, 'p-unassigned')).toEqual({
      projectId: 'p-3',
      milestoneId: null,
    });
    expect(filingOf({}, milestones, 'p-unassigned')).toEqual({
      projectId: 'p-unassigned',
      milestoneId: null,
    });
  });

  it('sends a filtered milestone the list does not have without a project, for the API to resolve', () => {
    // Dropping it filed the task under Unassigned without a word; guessing a project made the API refuse a real milestone.
    expect(
      filingOf({ milestoneId: 'm-gone', projectIds: ['p-3'] }, milestones, 'p-unassigned'),
    ).toEqual({
      projectId: undefined,
      milestoneId: 'm-gone',
    });
  });
});

describe('?project=', () => {
  const projects = [
    { id: 'p-web', slug: 'web', isUnassigned: false },
    { id: 'p-none', slug: 'unassigned-x', isUnassigned: true },
  ];

  it('reads one slug as it always did, and several comma-separated, each once', () => {
    expect(projectSlugsOf('web')).toEqual(['web']);
    expect(projectSlugsOf('web,billing,,web')).toEqual(['web', 'billing']);
    expect(projectSlugsOf(undefined)).toEqual([]);
    expect(projectParamOf([])).toBeUndefined();
    expect(projectParamOf(['web', 'billing'])).toBe('web,billing');
  });

  it('turns slugs into ids, leaving a stale one out but never widening to All projects', () => {
    expect(projectIdsOfSlugs(['web', 'unassigned', 'gone'], projects)).toEqual(['p-web', 'p-none']);
    // Reading `?project=gone` as no filter would show every project's tasks.
    expect(projectIdsOfSlugs(['gone'], projects)).toEqual([]);
    expect(columnOf([task('t')], 'todo', { projectIds: [] })).toEqual([]);
    expect(projectIdsOfSlugs([], projects)).toBeUndefined();
  });
});
