import { AppError } from '@oppenheimer/backend-core';
import type { LiveEvent } from '@oppenheimer/shared/live';
import { firstValueFrom, type Observable } from 'rxjs';
import { SessionChangedDomainEventHandler } from '../application/event-handlers/session-changed.domain-event-handler';
import type { LiveEventListener, LiveEventsPort } from '../application/live-events.port';
import { StreamLiveEventsQuery } from '../queries/stream-live-events/stream-live-events.query';
import { StreamLiveEventsQueryHandler } from '../queries/stream-live-events/stream-live-events.query-handler';

/** An in-process bus: what the Redis adapter does across replicas, in one. */
function fakeBus(): LiveEventsPort & { listeners: Map<string, Set<LiveEventListener>> } {
  const listeners = new Map<string, Set<LiveEventListener>>();
  return {
    listeners,
    async publish(organizationId, event) {
      for (const listener of listeners.get(organizationId) ?? []) listener(event);
    },
    async subscribe(organizationId, listener) {
      const set = listeners.get(organizationId) ?? new Set();
      listeners.set(organizationId, set);
      set.add(listener);
      return () => set.delete(listener);
    },
  };
}

describe('a session event', () => {
  it("names the session to its workspace's consoles", async () => {
    const bus = fakeBus();
    const stream = (await new StreamLiveEventsQueryHandler(bus).execute(
      new StreamLiveEventsQuery({ organizationId: 'org-1' }),
    )) as Observable<LiveEvent>;
    const next = firstValueFrom(stream);

    await new SessionChangedDomainEventHandler(bus).handle({
      aggregateId: 's-1',
      organizationId: 'org-1',
    });

    await expect(next).resolves.toEqual({ type: 'session.changed', sessionId: 's-1' });
  });

  it('is dropped, not thrown, when the bus refuses it', async () => {
    const bus = { ...fakeBus(), publish: vi.fn().mockRejectedValue(new Error('down')) };

    await expect(
      new SessionChangedDomainEventHandler(bus).handle({ aggregateId: 's-1', organizationId: 'o' }),
    ).resolves.toBeUndefined();
  });
});

describe('the live stream', () => {
  it('is refused with LIVE_001 when the bus cannot be reached', async () => {
    const bus = { ...fakeBus(), subscribe: vi.fn().mockRejectedValue(new Error('down')) };

    const refused = new StreamLiveEventsQueryHandler(bus).execute(
      new StreamLiveEventsQuery({ organizationId: 'org-1' }),
    );

    await expect(refused).rejects.toBeInstanceOf(AppError);
    await expect(refused).rejects.toMatchObject({ code: 'LIVE_001' });
  });

  it('lets go of the workspace once the console does', async () => {
    const bus = fakeBus();
    const stream = await new StreamLiveEventsQueryHandler(bus).execute(
      new StreamLiveEventsQuery({ organizationId: 'org-1' }),
    );

    stream.subscribe().unsubscribe();

    expect(bus.listeners.get('org-1')?.size).toBe(0);
  });
});
