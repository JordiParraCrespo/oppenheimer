import type { EventSourceFactory, EventSourceLike } from '@oppenheimer/frontend-core';
import RNEventSource from 'react-native-sse';

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

/**
 * Server-Sent Events for React Native, which has no `EventSource`, shaped as
 * the browser's one the kernel's streams read. `react-native-sse` speaks the
 * wire over XHR and carries the headers it is handed; the session is a
 * cookie the app holds itself, so each dial reads it fresh through `headers`.
 *
 * What the browser does on a failure is kept: a refusal (any 4xx, a 401 for a
 * signed-out session among them) closes for good and is never redialled; a
 * dropped connection or a 5xx reads as connecting while the library redials
 * on its own interval. A redial carries the headers of the dial that made it,
 * so a stream outliving its cookie is refused and the caller opens a new one.
 */
export function createEventSourceFactory(
  headers: () => Record<string, string>,
): EventSourceFactory {
  return (url) => new NativeEventSource(url, headers());
}

class NativeEventSource implements EventSourceLike {
  readyState = CONNECTING;
  onerror: ((event: Event) => void) | null = null;
  private readonly source: RNEventSource<string>;

  constructor(url: string, headers: Record<string, string>) {
    this.source = new RNEventSource<string>(url, { headers });
    this.source.addEventListener('open', () => {
      if (this.readyState !== CLOSED) this.readyState = OPEN;
    });
    this.source.addEventListener('error', (event) => {
      const status = 'xhrStatus' in event ? event.xhrStatus : 0;
      if (status >= 400 && status < 500) {
        this.readyState = CLOSED;
        // The library schedules its redial right after it dispatches this
        // error; closing once that has run is what clears the timer.
        queueMicrotask(() => this.source.close());
      } else {
        this.readyState = CONNECTING;
      }
      this.onerror?.(event as unknown as Event);
    });
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    this.source.addEventListener(type, (event) => {
      if ('data' in event && typeof event.data === 'string') {
        listener({ data: event.data } as MessageEvent<string>);
      }
    });
  }

  close(): void {
    this.readyState = CLOSED;
    this.source.close();
  }
}
