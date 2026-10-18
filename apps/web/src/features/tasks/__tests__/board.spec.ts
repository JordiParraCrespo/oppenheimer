import { TaskEntity } from '@oppenheimer/frontend-consumer';
import type { TaskStatus } from '@oppenheimer/shared/schemas/task';
import { describe, expect, it } from 'vitest';
import { afterTaskIdFor, boardCounts, columnOf, filingOf } from '../lib/board';
import { boardSearchSchema } from '../lib/board-search';
import { cardView, dueDayLabel } from '../lib/card-view';

function task(
  id: string,
  overrides: Partial<{
    status: TaskStatus;
    rank: string;
    projectId: string;
    milestoneId: string | null;
    dueDate: string | null;
    dueTime: string | null;
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
    overrides.status === 'done' ? new Date('2026-10-01T00:00:00Z') : null,
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
    expect(columnOf(rows, 'todo', { projectId: 'p-2' }).map((row) => row.id)).toEqual(['o']);
  });

  it('drops a card after the one above it, or first', () => {
    const column = columnOf(rows, 'todo', { projectId: 'p-1' });
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
    expect(boardCounts(board, { projectId: 'p-1' }, '2026-10-05')).toEqual({
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
      filter: { projectId: 'p-1', milestoneId: 'g' },
    });
    expect(filtered).toMatchObject({ projectName: null, milestoneName: null });
  });
});

describe('boardSearchSchema', () => {
  it('reads an empty value as absent, so a bare /plan is All projects', () => {
    expect(boardSearchSchema.parse({ project: '', task: 'new', stray: 'x' })).toEqual({
      project: undefined,
      milestone: undefined,
      task: 'new',
      start: undefined,
    });
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

  it('files in the filtered project, else Unassigned, when no milestone is filtered', () => {
    expect(filingOf({ projectId: 'p-3' }, milestones, 'p-unassigned')).toEqual({
      projectId: 'p-3',
      milestoneId: null,
    });
    expect(filingOf({}, milestones, 'p-unassigned')).toEqual({
      projectId: 'p-unassigned',
      milestoneId: null,
    });
  });

  it('keeps a filtered milestone the list no longer has, so the API reports it gone', () => {
    // Dropping it would file the task under Unassigned without a word.
    expect(filingOf({ milestoneId: 'm-gone' }, milestones, 'p-unassigned')).toEqual({
      projectId: 'p-unassigned',
      milestoneId: 'm-gone',
    });
  });
});
