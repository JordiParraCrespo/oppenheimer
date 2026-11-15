import { sessionEntity } from '@oppenheimer/frontend-consumer/testing';
import { describe, expect, it } from 'vitest';
import { askOf, filterCounts, matchesFilter, needsInput } from '../lib/session-filters';

/**
 * The Sessions tab's chips and the line a waiting row shows. What breaks if
 * these drift: a session waiting on the person sorted among the rest (or a
 * stopped one shown as waiting), a host's refused delete counted as fine, and
 * a waiting row with nothing to say about what it asks.
 */
describe('the Sessions tab', () => {
  const waiting = sessionEntity({ id: 'w', state: 'waiting-on-you' });
  const running = sessionEntity({ id: 'r', state: 'working' });
  const failed = sessionEntity({ id: 'f', state: 'idle', lifecycle: 'failed' });
  const refused = sessionEntity({
    id: 'x',
    state: 'idle',
    closeRefusal: { code: 'GIT_003', detail: null },
  });
  const stopped = sessionEntity({ id: 's', state: 'waiting-on-you', stoppedAt: new Date() });

  it('leads with a live session waiting on you, and not with one that has stopped', () => {
    expect(needsInput(waiting)).toBe(true);
    expect(needsInput(stopped)).toBe(false);
    expect(needsInput(running)).toBe(false);
  });

  it('counts a failed start and a refused delete as failed', () => {
    expect(matchesFilter(failed, 'failed')).toBe(true);
    expect(matchesFilter(refused, 'failed')).toBe(true);
    expect(matchesFilter(running, 'failed')).toBe(false);
  });

  it('counts each chip over the whole list', () => {
    expect(filterCounts([waiting, running, failed, refused])).toEqual({
      all: 4,
      'needs-input': 1,
      running: 1,
      failed: 2,
    });
  });

  it('says what a waiting session asks: the question, or what a permission is for', () => {
    const question = sessionEntity({
      decision: {
        kind: 'question',
        id: 'q',
        questions: [
          {
            header: null,
            question: 'Which approach?',
            multiSelect: false,
            options: [{ label: 'A', description: null }],
          },
        ],
      },
    });
    const permission = sessionEntity({
      decision: {
        kind: 'permission',
        id: 'p',
        title: 'Do you want to proceed?',
        detail: 'rm -rf build',
        options: [{ label: 'Yes' }, { label: 'No' }],
      },
    });
    expect(askOf(question)).toBe('Which approach?');
    expect(askOf(permission)).toBe('rm -rf build');
    expect(askOf(running)).toBeNull();
  });
});
