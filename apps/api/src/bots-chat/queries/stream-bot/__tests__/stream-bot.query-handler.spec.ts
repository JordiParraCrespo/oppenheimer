import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { BotStreamEvent, BotStreamSnapshot } from '@oppenheimer/shared';
import type { BotLookupPort } from '../../../../bots/application/bot-lookup.port';
import type { BotEntity } from '../../../../bots/domain/bot.entity';
import { BotErrors } from '../../../../bots/domain/bots.errors';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { StreamBotQuery } from '../stream-bot.query';
import { type BotStreamFrame, StreamBotQueryHandler } from '../stream-bot.query-handler';

/**
 * A bot's stream as a chat opening on it sees it: `ready`, then the text each
 * running turn has not stored yet as one `snapshot` each, then what the
 * channel carried while that was read, then the channel live. The snapshot
 * read and the channel are the adapter's (`bot-stream.integration.spec.ts`).
 */
const scope = {} as AccessScope;
const snapshot: BotStreamSnapshot = {
  type: 'snapshot',
  turnId: 't1',
  block: 1,
  seq: 4,
  text: 'Half a sent',
};
const delta = (seq: number, text: string): BotStreamEvent => ({
  type: 'text',
  turnId: 't1',
  block: 1,
  seq,
  text,
});

function setup() {
  let listener: (event: BotStreamEvent) => void = () => {};
  let readSnapshots: (snapshots: BotStreamSnapshot[]) => void = () => {};
  const unsubscribe = vi.fn();
  const stream = {
    publish: vi.fn(),
    write: vi.fn(),
    settle: vi.fn(),
    forget: vi.fn(),
    inFlight: vi.fn(
      () =>
        new Promise<BotStreamSnapshot[]>((resolve) => {
          readSnapshots = resolve;
        }),
    ),
    subscribe: vi.fn(async (_botId: string, heard: (event: BotStreamEvent) => void) => {
      listener = heard;
      return unsubscribe;
    }),
  } satisfies BotStreamPort;
  const lookup = { bot: vi.fn(async () => ({}) as BotEntity) } satisfies BotLookupPort;
  const handler = new StreamBotQueryHandler(lookup, stream);
  return {
    handler,
    stream,
    lookup,
    unsubscribe,
    hear: (event: BotStreamEvent) => listener(event),
    snapshots: (snapshots: BotStreamSnapshot[]) => readSnapshots(snapshots),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('StreamBotQueryHandler', () => {
  // What breaks this: a delta heard while the snapshot was read sent before
  // it, so the snapshot (older) replaces text the reader already had.
  it('sends ready, then each running turn’s snapshot, then what was heard while reading them', async () => {
    const bot = setup();
    const frames: BotStreamFrame[] = [];
    const observable = await bot.handler.execute(new StreamBotQuery(scope, 'bot-1'));
    const subscription = observable.subscribe((frame) => frames.push(frame));
    await flush();

    bot.hear(delta(4, 'ence'));
    bot.hear(delta(5, '.'));
    expect(frames).toEqual([]);
    bot.snapshots([snapshot]);
    await flush();
    bot.hear(delta(6, ' Next'));

    expect(frames).toEqual([
      { kind: 'ready' },
      { kind: 'event', event: snapshot },
      { kind: 'event', event: delta(4, 'ence') },
      { kind: 'event', event: delta(5, '.') },
      { kind: 'event', event: delta(6, ' Next') },
    ]);
    expect(bot.stream.inFlight).toHaveBeenCalledWith('bot-1');
    subscription.unsubscribe();
    expect(bot.unsubscribe).toHaveBeenCalled();
  });

  it('opens nothing on a bot the caller cannot read', async () => {
    const bot = setup();
    bot.lookup.bot.mockRejectedValueOnce(new AppError(BotErrors.NOT_FOUND));
    await expect(bot.handler.execute(new StreamBotQuery(scope, 'bot-1'))).rejects.toMatchObject({
      code: 'BOTS_001',
    });
    expect(bot.stream.subscribe).not.toHaveBeenCalled();
  });

  it('lets go of the channel when the chat leaves while the snapshot is read', async () => {
    const bot = setup();
    const frames: BotStreamFrame[] = [];
    const observable = await bot.handler.execute(new StreamBotQuery(scope, 'bot-1'));
    observable.subscribe((frame) => frames.push(frame)).unsubscribe();
    await flush();
    bot.snapshots([snapshot]);
    await flush();
    expect(bot.unsubscribe).toHaveBeenCalled();
    expect(frames).toEqual([]);
  });
});
