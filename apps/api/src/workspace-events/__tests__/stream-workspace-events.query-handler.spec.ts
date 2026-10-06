import type { WorkspaceEvent, WorkspaceEventType } from '@oppenheimer/shared/workspace-events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  WorkspaceEventAudience,
  WorkspaceEventBusPort,
} from '../application/workspace-event-bus.port';
import { StreamWorkspaceEventsQuery } from '../queries/stream-workspace-events/stream-workspace-events.query';
import {
  STREAM_KEEPALIVE_MS,
  STREAM_MAX_LIFETIME_MS,
  StreamWorkspaceEventsQueryHandler,
  type WorkspaceStreamFrame,
} from '../queries/stream-workspace-events/stream-workspace-events.query-handler';

/** A feed whose subscription resolves when the spec says so. */
function fakeFeed() {
  let deliver: (event: WorkspaceEvent) => void = () => {};
  let lose: () => void = () => {};
  let resolve: (off: () => void) => void = () => {};
  const off = vi.fn();
  const audiences: WorkspaceEventAudience[][] = [];
  const feed: WorkspaceEventBusPort = {
    publish: async () => undefined,
    subscribe: (asked, listener, onLost) => {
      audiences.push([...asked]);
      deliver = listener;
      lose = onLost ?? (() => {});
      return new Promise((done) => {
        resolve = done;
      });
    },
  };
  return {
    feed,
    off,
    audiences,
    subscribed: async () => {
      resolve(off);
      await Promise.resolve();
      await Promise.resolve();
    },
    deliver: (event: WorkspaceEvent) => deliver(event),
    /** The bus dropping the subscription, as a closed Redis connection does. */
    lose: () => lose(),
  };
}

async function open(
  fake: ReturnType<typeof fakeFeed>,
  organizationId: string | null = 'org-1',
  types: WorkspaceEventType[] = ['session.changed', 'host.changed'],
) {
  const handler = new StreamWorkspaceEventsQueryHandler(fake.feed);
  const frames: WorkspaceStreamFrame[] = [];
  let completed = false;
  const subscription = (
    await handler.execute(
      new StreamWorkspaceEventsQuery({ userId: 'u-1', organizationId, types: new Set(types) }),
    )
  ).subscribe({
    next: (frame) => frames.push(frame),
    complete: () => {
      completed = true;
    },
  });
  return { frames, subscription, completed: () => completed };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('StreamWorkspaceEventsQueryHandler', () => {
  it("listens to the caller's workspace and to the caller, whose hosts are theirs", async () => {
    const fake = fakeFeed();
    await open(fake);
    expect(fake.audiences).toEqual([[{ userId: 'u-1' }, { organizationId: 'org-1' }]]);
  });

  it('listens to the caller alone when there is no active workspace', async () => {
    const fake = fakeFeed();
    await open(fake, null);
    expect(fake.audiences).toEqual([[{ userId: 'u-1' }]]);
  });

  /**
   * The console stands its polls down on `ready`. Sent before the
   * subscription was in place, a change in that gap would be lost and
   * nothing would ask again.
   */
  it('says ready only once the subscription is in place, then streams each change', async () => {
    const fake = fakeFeed();
    const { frames } = await open(fake);
    expect(frames).toEqual([]);

    await fake.subscribed();
    fake.deliver({ type: 'session.changed', id: 's-1' });
    expect(frames).toEqual([
      { kind: 'ready' },
      { kind: 'change', event: { type: 'session.changed', id: 's-1' } },
    ]);
  });

  /** The feed is opened to anyone who may read one kind of change; the rest stay theirs. */
  it('drops a kind of change the caller may not read', async () => {
    const fake = fakeFeed();
    const { frames } = await open(fake, 'org-1', ['session.changed']);
    await fake.subscribed();
    fake.deliver({ type: 'automationRun.changed', id: 'r-1', automationId: 'a-1' });
    expect(frames).toEqual([{ kind: 'ready' }]);
  });

  /** A console that stood its polls down on `ready` must not be left on a deaf stream. */
  it('ends the stream when the bus drops its subscription, so the browser dials again', async () => {
    const fake = fakeFeed();
    const { completed } = await open(fake);
    await fake.subscribed();

    fake.lose();

    expect(completed()).toBe(true);
    expect(fake.off).toHaveBeenCalled();
  });

  it('ends the subscription when the client goes', async () => {
    const fake = fakeFeed();
    const { subscription } = await open(fake);
    await fake.subscribed();
    subscription.unsubscribe();
    expect(fake.off).toHaveBeenCalled();
  });

  it('ends a subscription that lands after the client has gone', async () => {
    const fake = fakeFeed();
    const { subscription, frames } = await open(fake);
    subscription.unsubscribe();
    await fake.subscribed();
    expect(fake.off).toHaveBeenCalled();
    expect(frames).toEqual([]);
  });

  /** An expired session keeps nothing streaming past this: the redial is authenticated again. */
  it('keeps an idle stream alive and ends it after its lifetime, both from the subscription', async () => {
    vi.useFakeTimers();
    const fake = fakeFeed();
    const { frames, completed } = await open(fake);
    vi.advanceTimersByTime(STREAM_KEEPALIVE_MS);
    expect(frames).toEqual([]);
    await fake.subscribed();

    vi.advanceTimersByTime(STREAM_KEEPALIVE_MS);
    expect(frames.at(-1)).toEqual({ kind: 'keepalive' });
    expect(completed()).toBe(false);

    vi.advanceTimersByTime(STREAM_MAX_LIFETIME_MS);
    expect(completed()).toBe(true);
    expect(fake.off).toHaveBeenCalled();
  });
});
