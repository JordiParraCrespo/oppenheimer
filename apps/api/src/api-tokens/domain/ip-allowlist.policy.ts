/**
 * Source-IP allowlist matching for API tokens. Entries are plain addresses
 * (`203.0.113.7`, `2001:db8::1`) or CIDR blocks (`203.0.113.0/24`).
 */

/** Parse an IPv4 address into its four octets, or `null` if malformed. */
function parseIPv4(address: string): number[] | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }
  return octets;
}

/**
 * Parse an IPv6 address into its sixteen bytes, or `null` if malformed.
 * Handles `::` compression and IPv4-mapped tails (`::ffff:192.0.2.1`).
 */
function parseIPv6(address: string): number[] | null {
  if (address.includes('.')) {
    const lastColon = address.lastIndexOf(':');
    const tail = parseIPv4(address.slice(lastColon + 1));
    if (!tail) return null;
    const head = address.slice(0, lastColon + 1);
    const hextets = `${head}${((tail[0] << 8) | tail[1]).toString(16)}:${(
      (tail[2] << 8) | tail[3]
    ).toString(16)}`;
    return parseIPv6(hextets);
  }

  const halves = address.split('::');
  if (halves.length > 2) return null;

  const toGroups = (value: string): number[] | null => {
    if (value === '') return [];
    const groups: number[] = [];
    for (const group of value.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
      groups.push(Number.parseInt(group, 16));
    }
    return groups;
  };

  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  if (!head || !tail) return null;

  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 0 : missing !== 0) return null;

  const groups = [...head, ...new Array(halves.length === 2 ? missing : 0).fill(0), ...tail];
  return groups.flatMap((group) => [(group >> 8) & 0xff, group & 0xff]);
}

/**
 * Normalize any address to its byte form. IPv4 and IPv4-mapped IPv6
 * (`::ffff:203.0.113.7`, which is what a dual-stack Node server reports for an
 * IPv4 client) both collapse to four bytes, so an IPv4 rule matches either.
 */
function toBytes(address: string): number[] | null {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const mapped = /^::ffff:(.+)$/i.exec(trimmed);
  if (mapped) {
    const ipv4 = parseIPv4(mapped[1]);
    if (ipv4) return ipv4;
  }

  if (trimmed.includes(':')) return parseIPv6(trimmed);
  return parseIPv4(trimmed);
}

/** The sixteen bytes of `::ffff:a.b.c.d` for an IPv4 address's four. */
function mappedIPv6(ipv4: number[]): number[] {
  return [...new Array(10).fill(0), 0xff, 0xff, ...ipv4];
}

export function matchesIpRule(entry: string, address: string): boolean {
  const segments = entry.trim().split('/');
  // A rule is `address` or `address/prefix` — anything else is malformed and
  // must not be silently reinterpreted as a wider block.
  if (segments.length > 2) return false;

  const [network, prefix] = segments;
  let networkBytes = toBytes(network);
  let addressBytes = toBytes(address);
  if (!networkBytes || !addressBytes) return false;

  let bits = prefix === undefined ? undefined : Number(prefix);
  if (bits !== undefined && !Number.isInteger(bits)) return false;
  // An IPv4-mapped network (`::ffff:203.0.113.0/120`) collapsed to four bytes,
  // but its prefix counts all 128 bits. From /96 on it is an IPv4 prefix 96
  // bits longer; shorter, it reaches past the mapped range, so both sides are
  // compared as the IPv6 addresses they are.
  if (bits !== undefined && networkBytes.length === 4 && network.includes(':')) {
    if (bits >= 96) bits -= 96;
    else {
      networkBytes = mappedIPv6(networkBytes);
      if (addressBytes.length === 4) addressBytes = mappedIPv6(addressBytes);
    }
  }
  // Never compare an IPv4 rule against IPv6 bytes (or vice versa).
  if (networkBytes.length !== addressBytes.length) return false;

  const totalBits = networkBytes.length * 8;
  bits ??= totalBits;
  if (bits < 0 || bits > totalBits) return false;

  const wholeBytes = Math.floor(bits / 8);
  for (let index = 0; index < wholeBytes; index += 1) {
    if (networkBytes[index] !== addressBytes[index]) return false;
  }

  const remainder = bits % 8;
  if (remainder === 0) return true;

  const mask = 0xff << (8 - remainder);
  return (networkBytes[wholeBytes] & mask) === (addressBytes[wholeBytes] & mask);
}

/**
 * Is `address` allowed by this list? An empty or absent list means the token
 * carries no IP restriction. A restricted token with an unresolvable source
 * address is denied — failing open here would make the restriction advisory.
 */
export function isIpAllowed(
  allowlist: readonly string[] | null | undefined,
  address: string | null | undefined,
): boolean {
  if (!allowlist || allowlist.length === 0) return true;
  if (!address) return false;
  return allowlist.some((entry) => matchesIpRule(entry, address));
}
