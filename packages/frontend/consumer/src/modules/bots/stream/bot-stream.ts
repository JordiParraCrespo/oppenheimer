import {
  BOT_STREAM_EVENT,
  BOT_STREAM_READY,
  BOT_TURN_STATUSES,
  type BotStreamEvent,
} from '@oppenheimer/shared/schemas/bot';
import type { EventSourceLike } from '../../organizations/events/workspace-event-stream';

/**
 * `live` from the API's `ready` frame; `down` before it and while the browser
 * redials; `closed` once the API refused the stream, which is not retried.
 */
export type BotStreamStatus = 'down' | 'live' | 'closed';

export interface BotStreamOptions {
  apiBaseUrl: string;
  botId: string;
  /** Injected in tests; `EventSource` with credentials otherwise. */
  sourceFactory?: (url: string) => EventSourceLike;
}

/** `EventSource.CLOSED`, without reading a global a non-browser test may not have. */
const CLOSED = 2;

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** A `bot` frame's data, checked, since it crossed the network. */
function isBotStreamEvent(value: unknown): value is BotStreamEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  if (!isString(event.turnId)) return false;
  switch (event.type) {
    case 'text':
      return isString(event.text);
    case 'message':
      return isString(event.messageId);
    case 'turn':
      return (BOT_TURN_STATUSES as readonly unknown[]).includes(event.status);
    default:
      return false;
  }
}

/**
 * One bot's chat as it happens (`GET /api/v1/bots/:id/stream`): text as a
 * turn writes it, and a nudge when a message is stored or a turn moves. The
 * stored conversation is the record; this is how it arrives early.
 *
 * The browser redials a dropped connection on its own, and the API ends the
 * stream every 15 minutes so the redial is authenticated again; a refused
 * stream stays closed. Nothing is opened until `open()`; `dispose()` closes
 * it for good.
 */
export class BotStream {
  private readonly eventListeners = new Set<(event: BotStreamEvent) => void>();
  private readonly statusListeners = new Set<(status: BotStreamStatus) => void>();
  private readonly sourceFactory: (url: string) => EventSourceLike;

  private source: EventSourceLike | null = null;
  private status: BotStreamStatus = 'down';

  constructor(private readonly options: BotStreamOptions) {
    this.sourceFactory =
      options.sourceFactory ?? ((url) => new EventSource(url, { withCredentials: true }));
  }

  onEvent(listener: (event: BotStreamEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /** The current status first, then each change. */
  onStatus(listener: (status: BotStreamStatus) => void): () => void {
    listener(this.status);
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  open(): void {
    if (this.source || this.status === 'closed') return;
    const { apiBaseUrl, botId } = this.options;
    const source = this.sourceFactory(
      `${apiBaseUrl}/api/v1/bots/${encodeURIComponent(botId)}/stream`,
    );
    this.source = source;

    source.addEventListener(BOT_STREAM_READY, () => {
      if (this.source === source) this.setStatus('live');
    });
    source.addEventListener(BOT_STREAM_EVENT, (message) => {
      if (this.source !== source) return;
      let event: unknown;
      try {
        event = JSON.parse(message.data);
      } catch {
        return;
      }
      if (!isBotStreamEvent(event)) return;
      for (const listener of this.eventListeners) listener(event);
    });
    source.onerror = () => {
      if (this.source !== source) return;
      if (source.readyState !== CLOSED) {
        this.setStatus('down');
        return;
      }
      this.close();
    };
  }

  dispose(): void {
    this.close();
    this.eventListeners.clear();
    this.statusListeners.clear();
  }

  private close(): void {
    this.source?.close();
    this.source = null;
    this.setStatus('closed');
  }

  private setStatus(next: BotStreamStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const listener of this.statusListeners) listener(next);
  }
}
