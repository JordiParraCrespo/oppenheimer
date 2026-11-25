import { sessionEntity } from '@oppenheimer/frontend-consumer/testing';
import { describe, expect, it } from 'vitest';
import {
  askOf,
  dotOf,
  filterCounts,
  leadKeyOf,
  matchesFilter,
  needsInput,
  sessionsListState,
} from '../lib/session-filters';

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

  it('colours each dot as its chip counts it, so the list and the chips agree', () => {
    expect([waiting, running, failed, refused].map(dotOf)).toEqual([
      'waiting',
      'running',
      'failed',
      'failed',
    ]);
    expect(dotOf(stopped)).toBe('idle');
  });

  it('leads a refused delete with why it is red, and any other row with its state', () => {
    expect(leadKeyOf(refused)).toBe('sessions.sidebar.notDeleted');
    expect(leadKeyOf(running)).toBe('sessions.session.state.working');
  });

  it('holds the list until the projects it groups by have loaded, so no row is filed as Unfiled', () => {
    const loaded = { data: [], isError: false };
    const loading = { data: undefined, isError: false };
    expect(sessionsListState([loaded, loading])).toBe('pending');
    expect(sessionsListState([loaded, loaded])).toBe('ready');
  });

  it('shows the failure when the projects read fails, rather than every row under Unfiled', () => {
    const loaded = { data: [], isError: false };
    const failedRead = { data: undefined, isError: true };
    expect(sessionsListState([loaded, failedRead])).toBe('failed');
    expect(sessionsListState([failedRead, loaded])).toBe('failed');
    // A refetch that fails over data already held keeps the list drawn.
    expect(sessionsListState([loaded, { data: [], isError: true }])).toBe('ready');
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
