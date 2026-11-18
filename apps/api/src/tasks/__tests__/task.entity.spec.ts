import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TaskActivityLoggedDomainEvent } from '../domain/events/task-activity-logged.domain-event';
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
    origin: 'person',
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

describe('TaskEntity: a task an agent made', () => {
  const fromAgent = () =>
    TaskEntity.createNew({
      organizationId: randomUUID(),
      projectId: randomUUID(),
      milestoneId: null,
      status: 'todo',
      title: 'Rotate the staging keys',
      createdByUserId: randomUUID(),
      actor: { type: 'agent', userId: randomUUID(), agentId: randomUUID() },
      origin: 'agent',
    });

  it('waits for its person, while a task the person made is taken up when it is made', () => {
    expect(fromAgent().triagedAt).toBeNull();
    expect(newTask().triagedAt).toBeInstanceOf(Date);
  });

  it('is taken up only by its person, once', () => {
    const task = fromAgent();
    task.triage('agent');
    expect(task.triagedAt).toBeNull();
    const at = new Date('2026-11-12T09:00:00Z');
    task.triage('person', at);
    task.triage('person', new Date('2026-11-13T09:00:00Z'));
    expect(task.triagedAt).toEqual(at);
  });
});

describe('TaskEntity: what a follower of its project is told', () => {
  // Regression: a bot following a project woke for a move with the wrong
  // columns, or twice for a placement retried after a lost rank race.
  it('raises one event per logged change, naming the columns a move went between', () => {
    const task = newTask();
    task.clearChanges();
    task.place('review', rankBetween('', null), new Date());
    task.place('review', rankBetween(rankBetween('', null), null), new Date());
    task.block('waiting on design');
    const events = task.activityEvents();
    expect(events.every((event) => event instanceof TaskActivityLoggedDomainEvent)).toBe(true);
    expect(events.map(({ kind, from, to }) => ({ kind, from, to }))).toEqual([
      { kind: 'status_changed', from: 'todo', to: 'review' },
      { kind: 'blocked', from: null, to: 'review' },
    ]);
    expect(events[0]).toMatchObject({
      aggregateId: task.id,
      projectId: task.projectId,
      title: 'Biometric unlock',
    });
  });

  it('tells completion, reopening and deletion by the column left and the one reached', () => {
    const task = newTask('doing');
    task.clearChanges();
    task.place('done', rankBetween('', null), new Date());
    expect(task.activityEvents().map(({ kind, from, to }) => [kind, from, to])).toEqual([
      ['completed', 'doing', 'done'],
    ]);
    task.clearChanges();
    task.remove();
    expect(task.activityEvents().map(({ kind, from, to }) => [kind, from, to])).toEqual([
      ['deleted', 'done', null],
    ]);
  });

  it('names where a reassigned task was, so followers of the place it left hear of it', () => {
    const task = newTask();
    const before = { projectId: task.projectId, milestoneId: null };
    task.clearChanges();
    task.file(randomUUID(), null);
    const [event] = task.activityEvents();
    expect(event).toMatchObject({ kind: 'reassigned', previous: before });
    expect(event.projectId).not.toBe(before.projectId);
  });
});
