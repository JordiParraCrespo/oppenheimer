import { STATUS_CODES } from 'node:http';
import type { Duplex } from 'node:stream';

/**
 * Names a refusal the runner acts on rather than retries. A bare status is not
 * enough for that: any proxy in front of the control plane can answer `410`,
 * and a runner that took a stranger's `410` as "you were unpaired" would stop
 * dialling for good.
 */
export const REFUSAL_HEADER = 'X-Oppenheimer-Refusal';

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
