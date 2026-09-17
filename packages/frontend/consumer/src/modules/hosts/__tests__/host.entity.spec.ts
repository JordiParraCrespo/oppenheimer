import { describe, expect, it } from 'vitest';
import { HostEntity, type HostState } from '../host.entity';

function host(state: HostState): HostEntity {
  return new HostEntity('host-1', 'mac-studio', state, null, new Date('2026-06-15T12:00:00Z'));
}

/** New session only offers a host whose runner is dialled in right now. */
describe('HostEntity.isOnline', () => {
  it('is true only for an online runner', () => {
    expect(host('online').isOnline).toBe(true);
    expect(host('offline').isOnline).toBe(false);
    expect(host('pairing').isOnline).toBe(false);
  });
});
