import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { BotStreamEvent, BotStreamSnapshot } from '@oppenheimer/shared';
import { Observable, type Subscriber } from 'rxjs';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BOT_STREAM } from '../../bots-chat.di-tokens';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { StreamBotQuery } from './stream-bot.query';

/** A keepalive under proxies' idle timeouts. */
export const BOT_STREAM_KEEPALIVE_MS = 25_000;
/** A stream ends after this, so the redial is authenticated again. */
export const BOT_STREAM_MAX_LIFETIME_MS = 15 * 60_000;

export type BotStreamFrame =
  | { kind: 'ready' }
  | { kind: 'event'; event: BotStreamEvent }
  | { kind: 'keepalive' };

/**
 * A bot's chat as it happens, for the chat open on it: the workspace stream's
 * shape (`StreamWorkspaceEventsQueryHandler`) on one bot's channel. The bot is
 * looked up as the caller first, so a stream never opens on another
 * workspace's bot.
 *
 * Once subscribed it reads the text each running turn has not stored yet,
 * and sends it as a `snapshot` per turn right after `ready`, before anything
 * the channel carried meanwhile: so a chat that connects mid-block, or comes
 * back after a drop, holds the whole block, and the deltas it then hears at
 * or below the snapshot's `seq` are ones it has.
 */
@QueryHandler(StreamBotQuery)
export class StreamBotQueryHandler
  implements IQueryHandler<StreamBotQuery, Observable<BotStreamFrame>>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  async execute({ scope, botId }: StreamBotQuery): Promise<Observable<BotStreamFrame>> {
    await this.lookup.bot(scope, botId);
    return new Observable<BotStreamFrame>((subscriber) => {
      let closed = false;
      let teardown = () => {};
      const catchUp = new CatchUp(
        (event) => subscriber.next({ kind: 'event', event }),
        () => closed,
      );
      this.stream
        .subscribe(botId, catchUp.hear, () => subscriber.complete())
        .then(async (unsubscribe) => {
          const snapshots = await catchUp.read(() => this.stream.inFlight(botId));
          if (!snapshots) return unsubscribe();
          teardown = keepOpen(subscriber, unsubscribe);
          subscriber.next({ kind: 'ready' });
          catchUp.release(snapshots);
        })
        .catch((error: unknown) => subscriber.error(error));
      return () => {
        closed = true;
        teardown();
      };
    });
  }
}

/**
 * Catching a new reader up: what the channel carries while the running turns'
 * text is read is held, and let go after the snapshots, so no snapshot lands
 * after a delta it already holds. Then it passes straight through.
 */
class CatchUp {
  private held: BotStreamEvent[] | null = [];

  constructor(
    private readonly emit: (event: BotStreamEvent) => void,
    private readonly isClosed: () => boolean,
  ) {}

  readonly hear = (event: BotStreamEvent): void => {
    if (this.held) this.held.push(event);
    else this.emit(event);
  };

  /** The snapshots to send; null when the reader left before or while they were read. */
  async read(inFlight: () => Promise<BotStreamSnapshot[]>): Promise<BotStreamSnapshot[] | null> {
    if (this.isClosed()) return null;
    const snapshots = await inFlight();
    return this.isClosed() ? null : snapshots;
  }

  /** The snapshots, then what was held; from here on, live. */
  release(snapshots: readonly BotStreamSnapshot[]): void {
    for (const event of [...snapshots, ...(this.held ?? [])]) this.emit(event);
    this.held = null;
  }
}

/** A keepalive under proxies' idle timeouts and an end after the lifetime; answers the teardown. */
function keepOpen(subscriber: Subscriber<BotStreamFrame>, unsubscribe: () => void): () => void {
  const keepalive = setInterval(
    () => subscriber.next({ kind: 'keepalive' }),
    BOT_STREAM_KEEPALIVE_MS,
  );
  const lifetime = setTimeout(() => subscriber.complete(), BOT_STREAM_MAX_LIFETIME_MS);
  keepalive.unref();
  lifetime.unref();
  return () => {
    clearInterval(keepalive);
    clearTimeout(lifetime);
    unsubscribe();
  };
}
