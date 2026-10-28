import { describe, expect, it } from 'vitest';
import { hostStartsCloud } from '../domain/host-cloud.policy';

describe('hostStartsCloud', () => {
  const ready = {
    online: true,
    liveCapabilities: ['session.folder', 'session.cloud'] as const,
    installedTools: ['git', 'tmux', 'claude'],
  };

  it('offers a host whose live runner takes cloud sessions and has claude', () => {
    expect(hostStartsCloud(ready)).toBe(true);
  });

  it('refuses a runner that predates cloud sessions, which would open a terminal instead', () => {
    expect(hostStartsCloud({ ...ready, liveCapabilities: ['session.folder'] })).toBe(false);
  });

  it('refuses a host without claude, whatever its runner takes', () => {
    expect(hostStartsCloud({ ...ready, installedTools: ['git', 'tmux'] })).toBe(false);
  });

  it('refuses an offline host, whose link is gone', () => {
    expect(hostStartsCloud({ ...ready, online: false })).toBe(false);
  });

  it('says it does not know when another process holds the link, rather than refusing', () => {
    expect(hostStartsCloud({ ...ready, liveCapabilities: null })).toBeNull();
  });

  it('does not rule out a host with no inventory yet', () => {
    expect(hostStartsCloud({ ...ready, installedTools: null })).toBe(true);
  });
});
