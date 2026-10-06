import type { LiveEvent } from '@oppenheimer/shared/live';
import Redis from 'ioredis';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { redisCommandClientOptions } from '../../config/redis.config';
import { RedisLiveEventsAdapter } from '../infrastructure/redis-live-events.adapter';

/**
 * Two adapters on one Redis are two API replicas: a domain event is heard on
 * one of them, and a workspace's console may be on the other. What breaks if
 * this fails: a session moves and the console that dialled the other replica
 * never hears it, while its polls are switched off.
 */
describe('Live events over Redis (integration)', () => {
  let container: StartedTestContainer;
  const clients: Redis[] = [];
  const adapters: RedisLiveEventsAdapter[] = [];

  const replica = async () => {
    const client = new Redis(
      redisCommandClientOptions({
        host: container.getHost(),
        port: container.getMappedPort(6379),
      } as never),
    );
    const adapter = new RedisLiveEventsAdapter(client);
    clients.push(client);
    adapters.push(adapter);
    // The client refuses a command until it is connected; wait for that
    // rather than for a publish to be refused.
    if (client.status !== 'ready') await new Promise((resolve) => client.once('ready', resolve));
    return adapter;
  };

  const heard = () => {
    const events: LiveEvent[] = [];
    let lost = 0;
    return {
      events,
      lost: () => lost,
      listener: { event: (event: LiveEvent) => events.push(event), lost: () => lost++ },
    };
  };

  const changed = (sessionId: string): LiveEvent => ({ type: 'session.changed', sessionId });

  beforeAll(async () => {
    container = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
  }, 120_000);

  afterAll(async () => {
    for (const adapter of adapters) await adapter.onApplicationShutdown();
    for (const client of clients) client.disconnect();
    await container?.stop();
  });

  it("delivers a workspace's event to its console on another replica, and to no other workspace", async () => {
    const publisher = await replica();
    const holder = await replica();
    const mine = heard();
    const theirs = heard();
    await holder.subscribe('org-1', mine.listener);
    await holder.subscribe('org-2', theirs.listener);

    await publisher.publish('org-1', changed('s-1'));

    await vi.waitFor(() => expect(mine.events).toEqual([changed('s-1')]));
    expect(theirs.events).toEqual([]);
  });

  it('keeps the channel while one console of the workspace is open, and leaves it with the last', async () => {
    const publisher = await replica();
    const holder = await replica();
    const first = heard();
    const second = heard();
    const leaveFirst = await holder.subscribe('org-3', first.listener);
    const leaveSecond = await holder.subscribe('org-3', second.listener);

    leaveFirst();
    await publisher.publish('org-3', changed('s-2'));
    await vi.waitFor(() => expect(second.events).toEqual([changed('s-2')]));
    expect(first.events).toEqual([]);

    leaveSecond();
    const probe = clients[0] as Redis;
    await vi.waitFor(async () => {
      const [, count] = (await probe.pubsub('NUMSUB', 'live:org:org-3')) as [string, number];
      expect(count).toBe(0);
    });
  });

  it('keeps the channel for a console that joins while the last one leaves', async () => {
    const publisher = await replica();
    const holder = await replica();
    const leaving = heard();
    const joining = heard();
    const leave = await holder.subscribe('org-4', leaving.listener);

    const joined = holder.subscribe('org-4', joining.listener);
    leave();
    await joined;
    await publisher.publish('org-4', changed('s-3'));

    await vi.waitFor(() => expect(joining.events).toEqual([changed('s-3')]));
  });

  it('tells every console when its connection to Redis drops', async () => {
    const holder = await replica();
    const first = heard();
    const second = heard();
    await holder.subscribe('org-5', first.listener);
    await holder.subscribe('org-6', second.listener);

    const probe = clients[0] as Redis;
    await probe.client('KILL', 'TYPE', 'pubsub');

    await vi.waitFor(() => {
      expect(first.lost()).toBe(1);
      expect(second.lost()).toBe(1);
    });
  });
});
