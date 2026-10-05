import { STATUS_CODES } from 'node:http';
import type { Duplex } from 'node:stream';
import { RUNNER_LINK_REFUSAL_HEADER } from '@oppenheimer/shared/protocol';

/** The protocol's `RUNNER_LINK_REFUSAL_HEADER`, which says why a bare status is not enough. */
export const REFUSAL_HEADER = RUNNER_LINK_REFUSAL_HEADER;

/**
 * Answer an upgrade request with a plain HTTP refusal and hang up. The body is
 * one line for a person reading a runner log; it names the rule, never which
 * check inside the rule refused. `refusal`, when given, is sent as
 * {@link REFUSAL_HEADER} so the runner can tell this control plane's verdict
 * from a proxy's status code.
 */
export function refuseUpgrade(
  socket: Duplex,
  status: number,
  reason: string,
  refusal?: string,
): void {
  const body = `${reason}\n`;
  socket.write(
    `HTTP/1.1 ${status} ${STATUS_CODES[status] ?? ''}\r\n` +
      'Connection: close\r\n' +
      (refusal ? `${REFUSAL_HEADER}: ${refusal}\r\n` : '') +
      'Content-Type: text/plain; charset=utf-8\r\n' +
      `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
  );
  socket.destroy();
}
