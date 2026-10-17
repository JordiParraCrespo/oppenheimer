import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { userActor } from '../domain/plan-change.types';
import { TaskEntity } from '../domain/task.entity';
import { rankBetween } from '../domain/task-rank.policy';

const newTask = (status: TaskEntity['status'] = 'todo') =>
  TaskEntity.createNew({
    organizationId: randomUUID(),
    projectId: randomUUID(),
    milestoneId: null,
    status,
    title: 'Biometric unlock',
    createdByUserId: randomUUID(),
    actor: userActor(randomUUID()),
  });

describe('TaskEntity: what a write logs', () => {
  it('logs a placement retried after a lost rank race once, from where it started', () => {
    const task = newTask();
    task.clearChanges();
    // The repository places, loses on the unique rank, rolls back and places again.
    task.place('done', rankBetween('', null), new Date());
    task.place('done', rankBetween(rankBetween('', null), null), new Date());
    expect(task.changesToLog.map((change) => [change.kind, change.payload])).toEqual([
      ['completed', { from: 'todo' }],
    ]);
  });

  it('refuses a change that names no one', () => {
    const task = TaskEntity.create({
      id: randomUUID(),
      props: { ...newTask().getProps() },
    });
    expect(() => task.block('waiting')).toThrow(/names who made it/);
  });

  it('does not block a Done task, and unblocks a task moved to Done', () => {
    const done = newTask('done');
    done.block('waiting');
    expect(done.blockedReason).toBeNull();

    const task = newTask();
    task.block('waiting on keys');
    task.place('done', rankBetween('', null), new Date());
    expect(task.blockedReason).toBeNull();
    expect(task.blockedAt).toBeNull();
  });
});
