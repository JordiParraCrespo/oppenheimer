import type { EventSourceFactory, EventSourceLike } from '@oppenheimer/frontend-core';
import { AppState, type NativeEventSubscription } from 'react-native';
import RNEventSource from 'react-native-sse';

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

/** How long a dropped stream waits to redial: a browser's `EventSource` waits about this long. */
const REDIAL_MS = 3000;

/**
 * Server-Sent Events for React Native, which has no `EventSource`, shaped as
 * the browser's one the kernel's streams read. `react-native-sse` speaks the
 * wire over XHR and carries the headers it is handed; the session is a
 * cookie the app holds itself, so each dial reads it fresh through `headers`.
 *
 * What the browser does on a failure is kept: a refusal (any 4xx, a 401 for a
 * signed-out session among them) closes for good and is never redialled; a
 * dropped connection or a 5xx reads as connecting while it is redialled. The
 * library redials a 5xx on its own interval but never a dropped connection
 * (an error with no status, which is what the phone's radio going away or
 * the app sitting in the background leaves), so this redials that one
 * itself, and at once when the app comes back to the foreground. A redial
 * carries the headers of the dial that made it, so a stream outliving its
 * cookie is refused and the caller opens a new one.
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
  private readonly foreground: NativeEventSubscription;
  /** The redial of a dropped connection, while one waits. */
  private redial: ReturnType<typeof setTimeout> | null = null;

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
        if (status === 0) this.redialIn(REDIAL_MS);
      }
      this.onerror?.(event as unknown as Event);
    });
    this.foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active' && this.redial !== null) this.redialIn(0);
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
    this.cancelRedial();
    this.foreground.remove();
    this.source.close();
  }

  private redialIn(ms: number): void {
    this.cancelRedial();
    this.redial = setTimeout(() => {
      this.redial = null;
      if (this.readyState !== CLOSED) this.source.open();
    }, ms);
  }

  private cancelRedial(): void {
    if (this.redial !== null) clearTimeout(this.redial);
    this.redial = null;
  }
}
