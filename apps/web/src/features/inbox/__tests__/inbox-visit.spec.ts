import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { afterEach, describe, expect, it } from 'vitest';
import { inboxVisit } from '../lib/inbox-visit';

/**
 * The deck's progress counts what this visit put away, each item once: an
 * answer that also settles the session's plain wait is one item, not two,
 * and marking an item done twice does not count it twice.
 */
afterEach(() => inboxVisit.clear());

const item = (key: string) => ({ key }) as InboxItem;

describe('inboxVisit.cleared', () => {
  it('counts an answer once, however many waits it settles', () => {
    inboxVisit.answered('session:s1:q1', 'session:s1:2026-11-24T00:00:00.000Z');
    expect(inboxVisit.get().cleared).toEqual(['session:s1:q1']);
  });

  it('counts each way of putting an item away, each item once', () => {
    inboxVisit.done(item('approval:1'));
    inboxVisit.done(item('approval:1'));
    inboxVisit.cleared('run:2');
    inboxVisit.forget('report:3');
    expect(inboxVisit.get().cleared).toEqual(['approval:1', 'run:2', 'report:3']);
  });

  it('starts again on the next visit', () => {
    inboxVisit.done(item('approval:1'));
    inboxVisit.follow('approval:1', 'run:2');
    inboxVisit.clear();
    expect(inboxVisit.get()).toEqual({
      later: [],
      done: [],
      doneItems: {},
      cleared: [],
      following: {},
    });
  });
});
