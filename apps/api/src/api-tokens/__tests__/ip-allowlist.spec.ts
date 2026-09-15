import { describe, expect, it } from 'vitest';
import { isIpAllowed, matchesIpRule } from '../domain/ip-allowlist';

describe('matchesIpRule', () => {
  it('matches a bare IPv4 address exactly', () => {
    expect(matchesIpRule('203.0.113.7', '203.0.113.7')).toBe(true);
    expect(matchesIpRule('203.0.113.7', '203.0.113.8')).toBe(false);
  });

  it('matches inside an IPv4 CIDR block', () => {
    expect(matchesIpRule('203.0.113.0/24', '203.0.113.200')).toBe(true);
    expect(matchesIpRule('203.0.113.0/24', '203.0.114.1')).toBe(false);
  });

  it('handles prefixes that fall mid-byte', () => {
    // 10.0.0.0/12 covers 10.0.0.0 – 10.15.255.255.
    expect(matchesIpRule('10.0.0.0/12', '10.15.255.255')).toBe(true);
    expect(matchesIpRule('10.0.0.0/12', '10.16.0.0')).toBe(false);
  });

  it('treats /0 as matching everything of the same family', () => {
    expect(matchesIpRule('0.0.0.0/0', '198.51.100.23')).toBe(true);
  });

  it('matches IPv6 addresses and blocks', () => {
    expect(matchesIpRule('2001:db8::1', '2001:db8::1')).toBe(true);
    expect(matchesIpRule('2001:db8::/32', '2001:db8:abcd::9')).toBe(true);
    expect(matchesIpRule('2001:db8::/32', '2001:db9::1')).toBe(false);
  });

  it('normalizes IPv4-mapped IPv6, which is what a dual-stack server reports', () => {
    expect(matchesIpRule('203.0.113.0/24', '::ffff:203.0.113.7')).toBe(true);
    expect(matchesIpRule('::ffff:203.0.113.7', '203.0.113.7')).toBe(true);
  });

  it('never matches an IPv4 rule against a real IPv6 address', () => {
    expect(matchesIpRule('0.0.0.0/0', '2001:db8::1')).toBe(false);
  });

  it('rejects malformed rules and addresses instead of throwing', () => {
    expect(matchesIpRule('not-an-ip', '203.0.113.7')).toBe(false);
    expect(matchesIpRule('203.0.113.7', 'nonsense')).toBe(false);
    expect(matchesIpRule('203.0.113.999', '203.0.113.999')).toBe(false);
    expect(matchesIpRule('203.0.113.0/33', '203.0.113.7')).toBe(false);
    expect(matchesIpRule('203.0.113.0/24/8', '203.0.113.7')).toBe(false);
  });
});

describe('isIpAllowed', () => {
  it('allows everything when there is no allowlist', () => {
    expect(isIpAllowed(null, '203.0.113.7')).toBe(true);
    expect(isIpAllowed([], '203.0.113.7')).toBe(true);
    expect(isIpAllowed(undefined, null)).toBe(true);
  });

  it('allows an address matching any entry', () => {
    expect(isIpAllowed(['198.51.100.0/24', '203.0.113.7'], '203.0.113.7')).toBe(true);
  });

  it('denies an address matching no entry', () => {
    expect(isIpAllowed(['198.51.100.0/24'], '203.0.113.7')).toBe(false);
  });

  it('denies a restricted credential whose source address is unknown', () => {
    // Failing open here would make the restriction advisory.
    expect(isIpAllowed(['198.51.100.0/24'], null)).toBe(false);
  });
});
