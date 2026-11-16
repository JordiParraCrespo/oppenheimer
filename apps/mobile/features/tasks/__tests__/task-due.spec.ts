import type { TaskEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { dueOf } from '../lib/task-due';

/**
 * A task's due date on the phone, as the console's card says it. What breaks
 * if it drifts: an overdue task not drawn red, a done task still showing its
 * date, or "Nov 18" where the reader expects Tomorrow.
 */
describe('a task’s due date on the phone', () => {
  const words = { today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday' };
  const task = (dueDate: string | null, dueTime: string | null = null, isDone = false) =>
    ({ dueDate, dueTime, isDone }) as unknown as TaskEntity;
  const today = '2026-11-16';

  it('says Today, Tomorrow and Yesterday next to today, with the time when one is set', () => {
    expect(dueOf(task('2026-11-16', '10:00'), today, 'en', words)).toEqual({
      text: 'Today · 10:00',
      tone: 'soon',
    });
    expect(dueOf(task('2026-11-17'), today, 'en', words)).toEqual({
      text: 'Tomorrow',
      tone: 'soon',
    });
    expect(dueOf(task('2026-11-15'), today, 'en', words)).toEqual({
      text: 'Yesterday',
      tone: 'overdue',
    });
  });

  it('names a further day by its date, quietly', () => {
    expect(dueOf(task('2026-11-25'), today, 'en', words)).toEqual({
      text: 'Nov 25',
      tone: 'default',
    });
  });

  it('says nothing without a date, or once the task is done', () => {
    expect(dueOf(task(null), today, 'en', words)).toBeNull();
    expect(dueOf(task('2026-11-15', null, true), today, 'en', words)).toBeNull();
  });
});
