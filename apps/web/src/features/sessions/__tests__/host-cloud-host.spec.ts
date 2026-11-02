import { HostEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { hostCloudHost } from '../lib/session-options';

/**
 * A host-cloud row under Cloud (Claude Code's, Codex's) starts from a host the
 * console picks. A regression that took the picked host whatever it could do
 * would send the task to a runner that refuses it (`SESSIONS_037`), when
 * another host could have started it.
 */
function host(
  id: string,
  online: boolean,
  startsCloud: boolean | null,
  startsCodexCloud: boolean | null = false,
): HostEntity {
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
    startsCloud: { 'claude-code': startsCloud, codex: startsCodexCloud },
    claudeAccount: null,
  });
}

describe('hostCloudHost', () => {
  it('keeps the picked host when it can start the session', () => {
    const hosts = [host('a', true, true), host('b', true, true)];
    expect(hostCloudHost(hosts, 'b', 'claude-code')?.id).toBe('b');
  });

  it('moves to a host that can when the picked one cannot', () => {
    const hosts = [host('old', true, false), host('new', true, true)];
    expect(hostCloudHost(hosts, 'old', 'claude-code')?.id).toBe('new');
  });

  it('prefers a host known to start it over the picked one nobody could vouch for', () => {
    const hosts = [host('unknown', true, null), host('ready', true, true)];
    expect(hostCloudHost(hosts, 'unknown', 'claude-code')?.id).toBe('ready');
  });

  it('tries a host the API could not vouch for when none is known to start it', () => {
    const hosts = [host('old', true, false), host('unknown', true, null)];
    expect(hostCloudHost(hosts, 'old', 'claude-code')?.id).toBe('unknown');
  });

  it('asks each agent’s cloud of its own: a host that starts Claude Code’s may not start Codex’s', () => {
    const hosts = [host('claude-only', true, true, false), host('both', true, true, true)];
    expect(hostCloudHost(hosts, 'claude-only', 'claude-code')?.id).toBe('claude-only');
    expect(hostCloudHost(hosts, 'claude-only', 'codex')?.id).toBe('both');
  });

  it('offers no host when every one is offline or cannot', () => {
    const hosts = [host('off', false, null), host('old', true, false)];
    expect(hostCloudHost(hosts, 'off', 'claude-code')).toBeNull();
  });
});
