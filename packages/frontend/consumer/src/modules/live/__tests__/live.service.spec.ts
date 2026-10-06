import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSUMER_CONFIG } from '../../../config';
import { LiveService, type LiveStatus } from '../live.service';
import { fakeSources } from './fake-source';

/**
 * The stream's status is what turns the session polls off, so what matters is
 * that it reads `live` only while the API is speaking, and that a refused dial
 * comes back on its own rather than leaving the console polling for good.
 */
describe('LiveService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function started() {
    const sources = fakeSources();
    const live = new LiveService('https://api.example.test', sources.factory);
    const statuses: LiveStatus[] = [];
    live.onStatus((status) => statuses.push(status));
    live.start();
    return { live, sources, statuses };
  }

  it('dials the live endpoint and reads live only once the API answers', () => {
    const { live, sources, statuses } = started();

    expect(sources.latest().url).toBe('https://api.example.test/api/v1/live');
    expect(live.status()).toBe('connecting');

    sources.latest().open();

    expect(statuses).toEqual(['connecting', 'live']);
  });

  it('hands on the events it can read and drops the rest', () => {
    const { live, sources } = started();
    const heard: unknown[] = [];
    live.onEvent((event) => heard.push(event));
    sources.latest().open();

    sources.latest().say({ type: 'session.changed', sessionId: 's-1' });
    sources.latest().say('not json');
    sources.latest().say({ type: 'something.else' });

    expect(heard).toEqual([{ type: 'session.changed', sessionId: 's-1' }]);
  });

  it('stops reading live while the browser dials a dropped stream again', () => {
    const { live, sources } = started();
    sources.latest().open();

    sources.latest().drop();

    expect(live.status()).toBe('connecting');
    expect(sources.opened).toHaveLength(1);
  });

  it('dials again on its own after the API refused it', () => {
    const { live, sources } = started();
    sources.latest().refuse();

    expect(live.status()).toBe('down');
    vi.advanceTimersByTime(CONSUMER_CONFIG.live.redialAfterRefusalMs);

    expect(sources.opened).toHaveLength(2);
    expect(live.status()).toBe('connecting');
  });

  it('closes the stream and forgets a pending redial when stopped', () => {
    const { live, sources } = started();
    sources.latest().refuse();

    live.stop();
    vi.advanceTimersByTime(CONSUMER_CONFIG.live.redialAfterRefusalMs);

    expect(live.status()).toBe('off');
    expect(sources.opened).toHaveLength(1);
  });
});
