import { BlockList, isIP } from 'node:net';

/**
 * Which addresses a bot's `web_fetch` may reach (`25-bots.md` §4.7): public
 * unicast ones only. The fetch runs on the control plane, so anything else
 * (loopback, the private networks, link-local and the cloud metadata
 * service, carrier-grade NAT, documentation, multicast, reserved) is the
 * server's own surroundings, not the web. An IPv6 address that carries an
 * IPv4 one (mapped, NAT64) is judged by the IPv4 it carries; 6to4 and Teredo
 * are refused outright, since they tunnel to an address we cannot see here.
 */
const BLOCKED = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  BLOCKED.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['100::', 64],
  ['2001::', 32],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  BLOCKED.addSubnet(network, prefix, 'ipv6');
}

const GLOBAL_UNICAST = new BlockList();
GLOBAL_UNICAST.addSubnet('2000::', 3, 'ipv6');

/** Whether `address` (an IP literal, IPv6 without brackets) is a public unicast address. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !BLOCKED.check(address, 'ipv4');
  if (family !== 6) return false;
  const embedded = embeddedIpv4(address);
  if (embedded !== null) return isIP(embedded) === 4 && !BLOCKED.check(embedded, 'ipv4');
  // Only global unicast (2000::/3) is the internet; site-local (fec0::/10),
  // unique-local, link-local and every other range is not.
  return GLOBAL_UNICAST.check(address, 'ipv6') && !BLOCKED.check(address, 'ipv6');
}

/** The IPv4 address an IPv4-mapped (`::ffff:0:0/96`) or NAT64 (`64:ff9b::/96`) address carries. */
function embeddedIpv4(address: string): string | null {
  const lower = address.toLowerCase();
  const prefix = ['::ffff:', '64:ff9b::'].find((candidate) => lower.startsWith(candidate));
  if (!prefix) return null;
  const rest = lower.slice(prefix.length);
  if (isIP(rest) === 4) return rest;
  const groups = rest.split(':');
  if (groups.length !== 2 || !groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) {
    // Any other spelling under these prefixes is still an embedded IPv4 we cannot read: refuse.
    return '0.0.0.0';
  }
  const [high, low] = groups.map((group) => Number.parseInt(group, 16));
  return [high >> 8, high & 255, low >> 8, low & 255].join('.');
}

/** Why a URL is refused before anything is resolved, or null when it may be tried. */
export function refuseUrl(url: URL): string | null {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return `Only http and https pages can be fetched, not ${url.protocol}`;
  }
  if (url.username || url.password) return 'A URL with a user name or password is refused.';
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicAddress(host)) return 'That address is not on the public internet.';
  const lower = host.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.internal')) {
    return 'That address is not on the public internet.';
  }
  return null;
}
