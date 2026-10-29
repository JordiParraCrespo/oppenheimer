import { HostEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { claudeCloudHost } from '../lib/session-options';

/**
 * The Claude Code row under Cloud starts from a host the console picks. A
 * regression that took the picked host whatever it could do would send the
 * task to a runner that refuses it (`SESSIONS_037`), when another host could
 * have started it.
 */
function host(id: string, online: boolean, startsCloud: boolean | null): HostEntity {
  return new HostEntity(id, id, online, null, null, null, null, null, new Date(0), {
    status: online ? 'idle' : 'offline',
    runningSessionCount: 0,
    osName: null,
    cpuCount: null,
    memoryTotalBytes: null,
    cloudProvider: null,
    countryCode: null,
    city: null,
    asnOrg: null,
    roundTripMillis: null,
    startsCloud,
    claudeAccount: null,
  });
}

describe('claudeCloudHost', () => {
  it('keeps the picked host when it can start the session', () => {
    const hosts = [host('a', true, true), host('b', true, true)];
    expect(claudeCloudHost(hosts, 'b')?.id).toBe('b');
  });

  it('moves to a host that can when the picked one cannot', () => {
    const hosts = [host('old', true, false), host('new', true, true)];
    expect(claudeCloudHost(hosts, 'old')?.id).toBe('new');
  });

  it('prefers a host known to start it over the picked one nobody could vouch for', () => {
    const hosts = [host('unknown', true, null), host('ready', true, true)];
    expect(claudeCloudHost(hosts, 'unknown')?.id).toBe('ready');
  });

  it('tries a host the API could not vouch for when none is known to start it', () => {
    const hosts = [host('old', true, false), host('unknown', true, null)];
    expect(claudeCloudHost(hosts, 'old')?.id).toBe('unknown');
  });

  it('offers no host when every one is offline or cannot', () => {
    const hosts = [host('off', false, null), host('old', true, false)];
    expect(claudeCloudHost(hosts, 'off')).toBeNull();
  });
});
