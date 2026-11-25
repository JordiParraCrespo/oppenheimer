import {
  cardView,
  type MilestoneEntity,
  type ProjectEntity,
  type TaskEntity,
} from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { cardContext } from '../lib/card-context';

/**
 * How the phone words a task through the shared card. What breaks if it
 * drifts: "Unassigned" printed on every row of an unfiled task, or a further
 * due date in ISO form rather than the reader's "Nov 25".
 */
describe('a task row on the phone', () => {
  const words = { today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday' };
  const projects = [
    { id: 'p', name: 'XRP Mobile', isUnassigned: false },
    { id: 'u', name: 'Unassigned', isUnassigned: true },
  ] as unknown as ProjectEntity[];
  const milestones = [{ id: 'm', name: 'TestFlight beta' }] as unknown as MilestoneEntity[];
  const context = cardContext({
    filter: {},
    today: '2026-11-16',
    locale: 'en',
    words,
    projects,
    milestones,
  });
  const task = (over: Partial<TaskEntity>) =>
    ({
      id: 't',
      title: 'T',
      notes: '',
      isDone: false,
      dueDate: null,
      dueTime: null,
      milestoneId: null,
      ...over,
    }) as TaskEntity;

  it('names the project and milestone, and a further due date by its day', () => {
    expect(
      cardView(task({ projectId: 'p', milestoneId: 'm', dueDate: '2026-11-25' }), context),
    ).toMatchObject({
      projectName: 'XRP Mobile',
      milestoneName: 'TestFlight beta',
      due: 'Nov 25',
      dueTone: 'default',
    });
  });

  it('says nothing of where an unfiled task is filed, and words a near day', () => {
    expect(
      cardView(task({ projectId: 'u', dueDate: '2026-11-17', dueTime: '09:00' }), context),
    ).toMatchObject({
      projectName: null,
      due: 'Tomorrow · 09:00',
      dueTone: 'soon',
    });
  });
});
