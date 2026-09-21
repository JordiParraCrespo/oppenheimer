import { describe, expect, it } from 'vitest';
import { HostEntity } from '../host.entity';

function host(online: boolean, os: string | null = null): HostEntity {
  return new HostEntity(
    'host-1',
    'mac-studio',
    online,
    null,
    os,
    null,
    null,
    null,
    new Date('2026-06-15T12:00:00Z'),
  );
}

/** New session only offers a host whose runner is dialled in right now. */
describe('HostEntity.isOnline', () => {
  it('follows what the API reported', () => {
    expect(host(true).isOnline).toBe(true);
    expect(host(false).isOnline).toBe(false);
  });
});

describe('HostEntity.summary', () => {
  it('names the machine and the OS its runner reported', () => {
    expect(host(true, 'macos').summary).toBe('mac-studio · macos');
  });

  // A runner that has not described itself yet would otherwise leave the row
  // reading "mac-studio · " — a separator with nothing after it.
  it('is the name alone until the runner has reported an OS', () => {
    expect(host(true, null).summary).toBe('mac-studio');
  });
});
