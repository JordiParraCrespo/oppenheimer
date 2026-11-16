import type { SessionEntity, TaskEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import {
  projectNeedsInputRows,
  projectStatusOf,
  projectTaskGroups,
  projectWaitingSessions,
} from '../lib/project-list';

/**
 * A project card's dot and a project page's panels read only that project's
 * sessions and tasks: a waiting session elsewhere never marks this card, and
 * a blocked task sits under Needs input, never under In progress as well.
 */
const session = (projectId: string, state: SessionEntity['state']) => ({ projectId, state });
const task = (projectId: string, status: TaskEntity['status'], blocked = false) =>
  ({
    id: `${projectId}-${status}-${blocked}`,
    projectId,
    status,
    isBlocked: blocked,
  }) as unknown as TaskEntity;

describe('projectStatusOf', () => {
  it('says Needs input before Running, and only for its own sessions', () => {
    const sessions = [
      session('a', 'working'),
      session('a', 'waiting-on-you'),
      session('b', 'working'),
    ];
    expect(projectStatusOf('a', sessions)).toBe('needs-input');
    expect(projectStatusOf('b', sessions)).toBe('running');
    expect(projectStatusOf('c', sessions)).toBe('idle');
  });

  it('counts a landing session as running and a resolved one as idle', () => {
    expect(projectStatusOf('a', [session('a', 'landing')])).toBe('running');
    expect(projectStatusOf('a', [session('a', 'resolved')])).toBe('idle');
  });
});

describe('projectWaitingSessions', () => {
  // Regression: the card said Needs input from a waiting session while the
  // project's page listed only blocked tasks, so the card led nowhere.
  it('lists every session that makes the card say Needs input, and only those', () => {
    const sessions = [
      session('a', 'waiting-on-you'),
      session('a', 'working'),
      session('b', 'waiting-on-you'),
    ];
    expect(projectStatusOf('a', sessions)).toBe('needs-input');
    expect(projectWaitingSessions('a', sessions)).toEqual([sessions[0]]);
    expect(projectWaitingSessions('c', sessions)).toEqual([]);
  });

  it("puts the project's waiting sessions before its blocked tasks under Needs input", () => {
    const waiting = session('a', 'waiting-on-you') as unknown as SessionEntity;
    const blocked = task('a', 'doing', true);
    const rows = projectNeedsInputRows(
      'a',
      [waiting, session('b', 'waiting-on-you') as unknown as SessionEntity],
      [blocked, task('a', 'doing')],
    );
    expect(rows).toEqual([
      { kind: 'session', session: waiting },
      { kind: 'task', task: blocked },
    ]);
    expect(projectNeedsInputRows('c', [waiting], [blocked])).toEqual([]);
  });
});

describe('projectTaskGroups', () => {
  it('puts a blocked task under Needs input only, and a doing one under In progress', () => {
    const blocked = task('a', 'doing', true);
    const doing = task('a', 'doing');
    const groups = projectTaskGroups('a', [blocked, doing, task('a', 'todo'), task('b', 'doing')]);
    expect(groups.blocked).toEqual([blocked]);
    expect(groups.doing).toEqual([doing]);
  });
});
