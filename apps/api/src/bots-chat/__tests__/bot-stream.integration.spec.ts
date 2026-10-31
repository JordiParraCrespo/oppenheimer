import type { ConfigService } from '@nestjs/config';
import type { BotStreamEvent } from '@oppenheimer/shared';
import Redis from 'ioredis';
import { firstValueFrom, type Observable, take, toArray } from 'rxjs';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import type { AccessScope } from '../../authz/domain/access-scope.types';
import type { BotLookupPort } from '../../bots/application/bot-lookup.port';
import type { BotEntity } from '../../bots/domain/bot.entity';
import { RedisPubSubAdapter } from '../../redis/infrastructure/redis-pub-sub.adapter';
import { RedisBotStreamAdapter } from '../infrastructure/redis-bot-stream.adapter';
import { StreamBotQuery } from '../queries/stream-bot/stream-bot.query';
import {
  type BotStreamFrame,
  StreamBotQueryHandler,
} from '../queries/stream-bot/stream-bot.query-handler';

/**
 * A bot's stream against a real Redis: the block a turn is writing is kept
 * beside the channel, so a chat that comes back after a drop is sent the
 * whole block as a `snapshot` (the deltas it missed included) and knows,
 * from `seq`, which deltas it already holds. What the chat then does with
 * the frames is the console's (`live-text.spec.ts`).
 */
describe('Bot stream (integration)', () => {
  let container: StartedTestContainer;
  let redis: Redis;
  let pubSub: RedisPubSubAdapter;
  let stream: RedisBotStreamAdapter;
  let handler: StreamBotQueryHandler;

  beforeAll(async () => {
    container = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
    const config = { host: container.getHost(), port: container.getMappedPort(6379) };
    redis = new Redis(config);
    pubSub = new RedisPubSubAdapter(redis, { get: () => config } as unknown as ConfigService);
    stream = new RedisBotStreamAdapter(pubSub, redis);
    const lookup = { bot: async () => ({}) as BotEntity } satisfies BotLookupPort;
    handler = new StreamBotQueryHandler(lookup, stream);
  }, 120_000);

  beforeEach(async () => {
    await redis.flushall();
  });

  afterAll(async () => {
    await pubSub?.onApplicationShutdown();
    await redis?.quit();
    await container?.stop();
  });

  /** A chat opening on the bot: the first `count` frames it is sent, keepalives aside. */
  async function connect(botId: string, count: number): Promise<BotStreamFrame[]> {
    const frames = (await handler.execute(
      new StreamBotQuery({} as AccessScope, botId),
    )) as Observable<BotStreamFrame>;
    return firstValueFrom(frames.pipe(take(count), toArray()));
  }

  const events = (frames: BotStreamFrame[]): BotStreamEvent[] =>
    frames.flatMap((frame) => (frame.kind === 'event' ? [frame.event] : []));

  /** The regression: deltas published while the chat was away never reached it. */
  it('sends a chat that comes back the whole block, the deltas it missed included', async () => {
    const botId = 'bot-1';
    const heard: BotStreamEvent[] = [];
    const unsubscribe = await stream.subscribe(
      botId,
      (event) => heard.push(event),
      () => {},
    );
    await stream.write(botId, 't1', 0, 'Hel');
    await expect.poll(() => heard).toHaveLength(1);
    unsubscribe();

    await stream.write(botId, 't1', 0, 'lo, ');
    await stream.write(botId, 't1', 0, 'world');

    const frames = await connect(botId, 2);
    expect(frames[0]).toEqual({ kind: 'ready' });
    expect(events(frames)).toEqual([
      { type: 'snapshot', turnId: 't1', block: 0, seq: 3, text: 'Hello, world' },
    ]);
    expect(heard).toEqual([{ type: 'text', turnId: 't1', block: 0, seq: 1, text: 'Hel' }]);
  });

  it('starts a new block from nothing, and keeps counting the turn’s writes', async () => {
    const botId = 'bot-1';
    await stream.write(botId, 't1', 0, 'First block.');
    await stream.settle(botId, 't1');
    expect(await stream.inFlight(botId)).toEqual([
      { type: 'snapshot', turnId: 't1', block: 0, seq: 1, text: '' },
    ]);
    await stream.write(botId, 't1', 1, 'Sec');
    await stream.write(botId, 't1', 1, 'ond');
    expect(await stream.inFlight(botId)).toEqual([
      { type: 'snapshot', turnId: 't1', block: 1, seq: 3, text: 'Second' },
    ]);
  });

  it('replaces a block it was never told was stored when a later one starts', async () => {
    const botId = 'bot-1';
    await stream.write(botId, 't1', 0, 'Kept');
    await stream.write(botId, 't1', 1, 'Next');
    expect(await stream.inFlight(botId)).toMatchObject([{ block: 1, text: 'Next' }]);
  });

  it('keeps nothing of a turn once it ended, and nothing outlives its expiry', async () => {
    const botId = 'bot-1';
    await stream.write(botId, 't1', 0, 'Done');
    await stream.write(botId, 't2', 0, 'Going');
    await stream.forget(botId, 't1');
    expect(await stream.inFlight(botId)).toMatchObject([{ turnId: 't2', text: 'Going' }]);
    const ttls = await Promise.all(
      [`bots:live:${botId}:turns`, 'bots:live:turn:t2:text', 'bots:live:turn:t2:place'].map((key) =>
        redis.ttl(key),
      ),
    );
    for (const ttl of ttls) expect(ttl).toBeGreaterThan(0);
  });

  it('reads every running turn at once, and drops one whose place expired under a dead worker', async () => {
    const botId = 'bot-1';
    await stream.write(botId, 't1', 0, 'One');
    await stream.write(botId, 't2', 2, 'Two');
    await stream.write(botId, 't3', 0, 'Gone');
    await redis.del('bots:live:turn:t3:place');
    const snapshots = await stream.inFlight(botId);
    expect(snapshots.sort((a, b) => a.turnId.localeCompare(b.turnId))).toEqual([
      { type: 'snapshot', turnId: 't1', block: 0, seq: 1, text: 'One' },
      { type: 'snapshot', turnId: 't2', block: 2, seq: 1, text: 'Two' },
    ]);
    expect((await redis.smembers(`bots:live:${botId}:turns`)).sort()).toEqual(['t1', 't2']);
  });

  it('gives every write of a turn its own seq when they race', async () => {
    const botId = 'bot-1';
    const heard: BotStreamEvent[] = [];
    const unsubscribe = await stream.subscribe(
      botId,
      (event) => heard.push(event),
      () => {},
    );
    await Promise.all(['a', 'b', 'c', 'd'].map((text) => stream.write(botId, 't1', 0, text)));
    await expect.poll(() => heard).toHaveLength(4);
    unsubscribe();
    const seqs = heard.map((event) => (event.type === 'text' ? event.seq : 0)).sort();
    expect(seqs).toEqual([1, 2, 3, 4]);
    const [snapshot] = await stream.inFlight(botId);
    expect(snapshot?.text.split('').sort().join('')).toBe('abcd');
  });
});
