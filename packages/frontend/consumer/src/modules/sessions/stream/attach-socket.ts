import { type AttachServerMessage, attachServerMessageSchema } from '@oppenheimer/shared/protocol';
import { CONSUMER_CONFIG } from '../../../config';

/** How a stream opens a socket: `WebSocket`, or a test's fake. */
export type SocketFactory = (url: string, protocols: string[]) => WebSocket;

export const webSocketFactory: SocketFactory = (url, protocols) => new WebSocket(url, protocols);

/** How a stream waits: `setTimeout`, or a test's clock. Returns the cancel. */
export type Schedule = (fn: () => void, ms: number) => () => void;

export const timeoutSchedule: Schedule = (fn, ms) => {
  const timer = setTimeout(fn, ms);
  return () => clearTimeout(timer);
};

/** The attach socket's URL for a ticket's path, on the API's origin (or the page's). */
export function attachSocketUrl(path: string, apiBaseUrl: string | undefined): string {
  const base = apiBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const url = new URL(path, base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

/**
 * The attach socket for a ticket: the ticket rides as the subprotocol, and
 * output arrives as bytes.
 */
export function openAttachSocket(
  socketFactory: SocketFactory,
  ticket: { ticket: string; url: string },
  apiBaseUrl: string | undefined,
): WebSocket {
  const socket = socketFactory(attachSocketUrl(ticket.url, apiBaseUrl), [ticket.ticket]);
  socket.binaryType = 'arraybuffer';
  return socket;
}

/** A control frame, or null for one that is not JSON or not one this build reads. */
export function readAttachMessage(raw: string): AttachServerMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const message = attachServerMessageSchema.safeParse(parsed);
  return message.success ? message.data : null;
}

/**
 * How long to wait before the next dial, after `attempt` failed ones: the
 * configured ladder (`CONSUMER_CONFIG.stream.reconnectLadderMs`), each step
 * jittered by ±20% so a relay restart is not redialled by every tab at once.
 */
export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const ladder = CONSUMER_CONFIG.stream.reconnectLadderMs;
  const base = ladder[Math.min(attempt, ladder.length - 1)] ?? ladder[ladder.length - 1] ?? 0;
  const jitter = base * (random() * 0.4 - 0.2);
  return Math.max(0, Math.round(base + jitter));
}
