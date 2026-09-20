import { describe, expect, it } from 'vitest';
import {
  HOST_PRINCIPAL,
  type HostPrincipalRequest,
  hostPrincipalOf,
} from '../current-host.decorator';

describe('hostPrincipalOf', () => {
  it('returns the host the guard admitted', () => {
    const request: HostPrincipalRequest = { [HOST_PRINCIPAL]: { hostId: 'host-1' } };

    expect(hostPrincipalOf(request)).toBe('host-1');
  });

  it('refuses rather than returning undefined when no guard ran', () => {
    // A route that read this without `HostPrincipalGuard` would otherwise hand
    // its handler an `undefined` host id and act on it.
    expect(() => hostPrincipalOf({})).toThrowError(expect.objectContaining({ code: 'HOSTS_005' }));
  });
});
