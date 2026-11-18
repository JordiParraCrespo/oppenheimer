// @vitest-environment node
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { INBOX_MARK_ACTIONS } from '../lib/inbox-mark-actions';

/**
 * One table says what each Inbox action stores, for a row and for a
 * selection alike. Deprioritize restores priority only when every item is
 * already low: a mixed selection is deprioritized, never half restored.
 */
const item = (key: string, low: boolean) => ({ key, low }) as InboxItem;
const NOW = new Date('2026-11-11T10:00:00');

describe('what an Inbox action stores', () => {
  it('deprioritizes a mixed selection and restores one that is all low', () => {
    const { write } = INBOX_MARK_ACTIONS.toggleLow;
    expect(write([item('a', true), item('b', false)], NOW)).toEqual({ mark: 'low' });
    expect(write([item('a', true), item('b', true)], NOW)).toEqual({ mark: null });
  });

  it('snoozes until tomorrow at nine, the reader’s time', () => {
    expect(INBOX_MARK_ACTIONS.snoozeTomorrow.write([], NOW)).toEqual({
      mark: 'snoozed',
      until: new Date('2026-11-12T09:00:00'),
    });
  });

  it('takes up a task an agent made on Delete only, so one marked done can come back', () => {
    const task = { key: 'task:t-1', kind: 'task', task: { id: 't-1' } } as InboxItem;
    const run = { key: 'run:r-1', kind: 'run' } as InboxItem;
    expect(INBOX_MARK_ACTIONS.remove.takesUp?.(task)).toBe('t-1');
    expect(INBOX_MARK_ACTIONS.remove.takesUp?.(run)).toBeNull();
    for (const name of [
      'done',
      'toggleLow',
      'snoozeHour',
      'snoozeTomorrow',
      'bringBack',
    ] as const) {
      expect(INBOX_MARK_ACTIONS[name].takesUp).toBeUndefined();
    }
  });
});
