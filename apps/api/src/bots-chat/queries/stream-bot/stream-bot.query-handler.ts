import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { BotStreamEvent } from '@oppenheimer/shared';
import { Observable } from 'rxjs';
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
      // Held until the snapshots are out, so none of them lands after a delta it already holds.
      let held: BotStreamEvent[] | null = [];
      this.stream
        .subscribe(
          botId,
          (event) => {
            if (held) held.push(event);
            else subscriber.next({ kind: 'event', event });
          },
          () => subscriber.complete(),
        )
        .then(async (unsubscribe) => {
          const snapshots = closed ? [] : await this.stream.inFlight(botId);
          if (closed) {
            unsubscribe();
            return;
          }
          const keepalive = setInterval(
            () => subscriber.next({ kind: 'keepalive' }),
            BOT_STREAM_KEEPALIVE_MS,
          );
          const lifetime = setTimeout(() => subscriber.complete(), BOT_STREAM_MAX_LIFETIME_MS);
          keepalive.unref();
          lifetime.unref();
          teardown = () => {
            clearInterval(keepalive);
            clearTimeout(lifetime);
            unsubscribe();
          };
          subscriber.next({ kind: 'ready' });
          for (const event of [...snapshots, ...(held ?? [])]) {
            subscriber.next({ kind: 'event', event });
          }
          held = null;
        })
        .catch((error: unknown) => subscriber.error(error));
      return () => {
        closed = true;
        teardown();
      };
    });
  }
}
