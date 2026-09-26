import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { clientAddressOf } from '../infrastructure/client-address.util';

function request(peer: string, forwarded?: string): IncomingMessage {
  return {
    socket: { remoteAddress: peer },
    headers: forwarded ? { 'x-forwarded-for': forwarded } : {},
  } as unknown as IncomingMessage;
}

describe('clientAddressOf', () => {
  it('believes no header with no trusted proxy: it is whatever the client sent', () => {
    expect(clientAddressOf(request('203.0.113.7', '1.2.3.4'), 0)).toBe('203.0.113.7');
  });

  it('takes the entry one hop back behind one trusted proxy, as Express does', () => {
    expect(clientAddressOf(request('10.0.0.2', '1.2.3.4, 198.51.100.9'), 1)).toBe('198.51.100.9');
  });

  it('never walks past the end of the chain', () => {
    expect(clientAddressOf(request('10.0.0.2', '198.51.100.9'), 5)).toBe('198.51.100.9');
  });

  it('unwraps an IPv4 address mapped into IPv6, so one machine is one address', () => {
    expect(clientAddressOf(request('::ffff:203.0.113.7'), 0)).toBe('203.0.113.7');
  });
});
