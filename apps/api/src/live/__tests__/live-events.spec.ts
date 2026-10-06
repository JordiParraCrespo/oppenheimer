import { AppError } from '@oppenheimer/backend-core';
import type { LiveEvent } from '@oppenheimer/shared/live';
import type Redis from 'ioredis';
import { firstValueFrom, type Observable } from 'rxjs';
import { SessionChangedDomainEventHandler } from '../application/event-handlers/session-changed.domain-event-handler';
import type { LiveEventListener, LiveEventsPort } from '../application/live-events.port';
import { RedisLiveEventsAdapter } from '../infrastructure/redis-live-events.adapter';
import { StreamLiveEventsQuery } from '../queries/stream-live-events/stream-live-events.query';
import { StreamLiveEventsQueryHandler } from '../queries/stream-live-events/stream-live-events.query-handler';

/** An in-process bus: what the Redis adapter does across replicas, in one. */
function fakeBus() {
  const listeners = new Map<string, Set<LiveEventListener>>();
  const bus: LiveEventsPort = {
    async publish(organizationId, event) {
      for (const listener of listeners.get(organizationId) ?? []) listener.event(event);
    },
    async subscribe(organizationId, listener) {
      const set = listeners.get(organizationId) ?? new Set();
      listeners.set(organizationId, set);
      set.add(listener);
      return () => set.delete(listener);
    },
  };
  /** The bus dropping the workspace's channel. */
  const lose = (organizationId: string) => {
    for (const listener of listeners.get(organizationId) ?? []) listener.lost();
    listeners.delete(organizationId);
  };
  return { bus, listeners, lose };
}

const stream = (bus: LiveEventsPort, organizationId = 'org-1') =>
  new StreamLiveEventsQueryHandler(bus).execute(
    new StreamLiveEventsQuery({ organizationId }),
  ) as Promise<Observable<LiveEvent>>;

describe('a session event', () => {
  it("names the session to its workspace's consoles", async () => {
    const { bus } = fakeBus();
    const next = firstValueFrom(await stream(bus));

    await new SessionChangedDomainEventHandler(bus).handle({
      aggregateId: 's-1',
      organizationId: 'org-1',
    });

    await expect(next).resolves.toEqual({ type: 'session.changed', sessionId: 's-1' });
  });
});

describe('publishing', () => {
  it('never fails the domain event it was raised for', async () => {
    const redis = { publish: vi.fn().mockRejectedValue(new Error('down')) } as unknown as Redis;

    await expect(
      new RedisLiveEventsAdapter(redis).publish('org-1', {
        type: 'session.changed',
        sessionId: 's-1',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('the live stream', () => {
  afterEach(() => vi.useRealTimers());

  it('is refused with LIVE_001 when the bus cannot be reached', async () => {
    const { bus } = fakeBus();
    const refused = stream({ ...bus, subscribe: vi.fn().mockRejectedValue(new Error('down')) });

    await expect(refused).rejects.toBeInstanceOf(AppError);
    await expect(refused).rejects.toMatchObject({ code: 'LIVE_001' });
  });

  it('lets go of the workspace once the console does', async () => {
    const { bus, listeners } = fakeBus();

    (await stream(bus)).subscribe().unsubscribe();

    expect(listeners.get('org-1')?.size).toBe(0);
  });

  it('ends when the bus drops the channel, so the console dials again', async () => {
    const { bus, lose } = fakeBus();
    const complete = vi.fn();
    (await stream(bus)).subscribe({ complete });

    lose('org-1');

    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('lets go of a subscription no response ever took', async () => {
    vi.useFakeTimers();
    const { bus, listeners } = fakeBus();
    const live = await stream(bus);

    vi.advanceTimersByTime(10_000);

    expect(listeners.get('org-1')?.size).toBe(0);
    const complete = vi.fn();
    live.subscribe({ complete });
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
