import {
  type EventSourceLike,
  ServerEventStream,
  type ServerEventStreamStatus,
} from '@oppenheimer/frontend-core';
import {
  BOT_STREAM_EVENT,
  BOT_STREAM_READY,
  type BotStreamEvent,
  botStreamEventSchema,
} from '@oppenheimer/shared/schemas/bot';

/** `live` from the API's `ready` frame, `down` while redialling, `closed` once refused. */
export type BotStreamStatus = ServerEventStreamStatus;

export interface BotStreamOptions {
  apiBaseUrl: string;
  botId: string;
  /** Injected in tests; `EventSource` with credentials otherwise. */
  sourceFactory?: (url: string) => EventSourceLike;
}

/**
 * One bot's chat as it happens (`GET /api/v1/bots/:id/stream`): text as a
 * turn writes it, and a nudge when a message is stored or a turn moves. The
 * stored conversation is the record; this is how it arrives early. The API
 * ends the stream every 15 minutes so the browser's redial is authenticated
 * again.
 */
export class BotStream extends ServerEventStream<BotStreamEvent> {
  constructor({ apiBaseUrl, botId, sourceFactory }: BotStreamOptions) {
    super({
      url: `${apiBaseUrl}/api/v1/bots/${encodeURIComponent(botId)}/stream`,
      readyEvent: BOT_STREAM_READY,
      eventName: BOT_STREAM_EVENT,
      read: (data) => {
        const parsed = botStreamEventSchema.safeParse(data);
        return parsed.success ? parsed.data : null;
      },
      sourceFactory,
    });
  }
}
