import type { EventSourceFactory, EventSourceLike } from '@oppenheimer/frontend-core';
import { AppState, type NativeEventSubscription } from 'react-native';
import RNEventSource from 'react-native-sse';

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

/** How long a redial waits, the library's own polling interval. */
const REDIAL_MS = 5000;

/**
 * Server-Sent Events for React Native, which has no `EventSource`, shaped as
 * the browser's one the kernel's streams read. `react-native-sse` speaks the
 * wire over XHR and carries the headers it is handed; the session is a
 * cookie the app holds itself and rotates, so every dial, a redial included,
 * reads it afresh through `headers`.
 *
 * What the browser does on a failure is kept: a refusal (any 4xx, a 401 for a
 * signed-out session among them) closes for good and is never redialled; a
 * dropped connection, an unreachable server or a 5xx reads as connecting and
 * is redialled until it answers, however long that takes, and at once when
 * the app comes back to the foreground, where a locked phone or a backgrounded
 * app leaves a dropped stream.
 */
export function createEventSourceFactory(
  headers: () => Record<string, string>,
): EventSourceFactory {
  return (url) => new NativeEventSource(url, headers);
}

/**
 * The library redials only after a response it saw finish with a status: a
 * stream that ended, or an error status. A request that never got one (the
 * server unreachable, the network gone: status 0) dispatches an error and is
 * left for dead, so an outage longer than one redial interval used to end the
 * feed for good. Those are redialled here; `open` is the one place every dial
 * passes through, the library's and ours.
 */
class Dialler extends RNEventSource<string> {
  constructor(
    url: string,
    private readonly readHeaders: () => Record<string, string>,
    private readonly onDial: () => void,
  ) {
    super(url, { pollingInterval: REDIAL_MS });
  }

  override open(): void {
    // `headers` is the field the library reads in `open`; it is not typed.
    (this as unknown as { headers: Record<string, string> }).headers = this.readHeaders();
    this.onDial();
    super.open();
  }
}

class NativeEventSource implements EventSourceLike {
  readyState = CONNECTING;
  onerror: ((event: Event) => void) | null = null;
  private readonly source: Dialler;
  private redial: ReturnType<typeof setTimeout> | null = null;
  private readonly foreground: NativeEventSubscription;

  constructor(url: string, headers: () => Record<string, string>) {
    this.source = new Dialler(url, headers, () => this.dialling());
    this.source.addEventListener('open', () => {
      if (this.readyState !== CLOSED) this.readyState = OPEN;
    });
    this.source.addEventListener('error', (event) => {
      if (this.readyState === CLOSED) return;
      const status = 'xhrStatus' in event ? event.xhrStatus : 0;
      if (status >= 400 && status < 500) {
        this.readyState = CLOSED;
        // The library schedules its redial right after it dispatches this
        // error; closing once that has run is what clears the timer.
        queueMicrotask(() => this.source.close());
      } else {
        this.readyState = CONNECTING;
        // Any other status the library redials itself; without one it never does.
        if (!status) this.scheduleRedial();
      }
      this.onerror?.(event as unknown as Event);
    });
    this.foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active' && this.redial) this.scheduleRedial(0);
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
    this.clearRedial();
    this.foreground.remove();
    this.source.close();
  }

  /** A dial is starting: a stream that was open has ended, which the browser reports as an error. */
  private dialling(): void {
    this.clearRedial();
    if (this.readyState !== OPEN) return;
    this.readyState = CONNECTING;
    this.onerror?.({ type: 'error' } as Event);
  }

  private scheduleRedial(ms = REDIAL_MS): void {
    this.clearRedial();
    this.redial = setTimeout(() => {
      this.redial = null;
      if (this.readyState !== CLOSED) this.source.open();
    }, ms);
  }

  private clearRedial(): void {
    if (this.redial) clearTimeout(this.redial);
    this.redial = null;
  }
}
