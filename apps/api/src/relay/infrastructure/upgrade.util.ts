import { STATUS_CODES } from 'node:http';
import type { Duplex } from 'node:stream';

/**
 * Answer an upgrade request with a plain HTTP refusal and hang up. The body is
 * one line for a person reading a runner log; it names the rule, never which
 * check inside the rule refused.
 */
export function refuseUpgrade(socket: Duplex, status: number, reason: string): void {
  const body = `${reason}\n`;
  socket.write(
    `HTTP/1.1 ${status} ${STATUS_CODES[status] ?? ''}\r\n` +
      'Connection: close\r\n' +
      'Content-Type: text/plain; charset=utf-8\r\n' +
      `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
  );
  socket.destroy();
}
