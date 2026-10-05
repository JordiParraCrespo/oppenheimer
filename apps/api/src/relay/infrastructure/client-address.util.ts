import type { IncomingMessage } from 'node:http';

/**
 * The address a runner's link came from, by Express's `request.ip` rule for
 * `trust proxy = <hops>`: the socket's peer, or the `X-Forwarded-For` entry that
 * many hops back. An upgrade never reaches Express, so the rule is applied here with
 * the API's `TRUST_PROXY`. With no trusted hops the header, being whatever the
 * client sent, is ignored. IPv4-mapped IPv6 (`::ffff:203.0.113.7`) is unwrapped, so
 * one machine is one address.
 */
export function clientAddressOf(request: IncomingMessage, trustedHops: number): string | null {
  const peer = request.socket?.remoteAddress ?? null;
  const forwarded = request.headers['x-forwarded-for'];
  const chain = (Array.isArray(forwarded) ? forwarded.join(',') : (forwarded ?? ''))
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reverse();
  const addresses = [peer, ...chain].filter((entry): entry is string => Boolean(entry));
  if (addresses.length === 0) return null;
  const chosen = addresses[Math.min(Math.max(trustedHops, 0), addresses.length - 1)];
  return unmapped(chosen);
}

function unmapped(address: string): string {
  const match = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  return match ? match[1] : address;
}
