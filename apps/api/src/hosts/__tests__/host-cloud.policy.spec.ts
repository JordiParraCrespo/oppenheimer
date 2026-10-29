import { describe, expect, it } from 'vitest';
import { hostStartsCloud } from '../domain/host-cloud.policy';

describe('hostStartsCloud', () => {
  const ready = {
    online: true,
    liveCapabilities: ['session.folder', 'session.cloud'] as const,
    installedTools: ['git', 'tmux', 'claude'],
  };

  it('offers a host whose live runner takes cloud sessions and has claude', () => {
    expect(hostStartsCloud(ready, 'claude-code')).toBe(true);
  });

  it('refuses a runner that predates cloud sessions, which would open a terminal instead', () => {
    expect(hostStartsCloud({ ...ready, liveCapabilities: ['session.folder'] }, 'claude-code')).toBe(
      false,
    );
  });

  it('refuses a host without claude, whatever its runner takes', () => {
    expect(hostStartsCloud({ ...ready, installedTools: ['git', 'tmux'] }, 'claude-code')).toBe(
      false,
    );
  });

  it('refuses an offline host, whose link is gone', () => {
    expect(hostStartsCloud({ ...ready, online: false }, 'claude-code')).toBe(false);
  });

  it('says it does not know when another process holds the link, rather than refusing', () => {
    expect(hostStartsCloud({ ...ready, liveCapabilities: null }, 'claude-code')).toBeNull();
  });

  it('offers Codex cloud only from a runner that named session.cloud.codex and has codex', () => {
    const codexReady = {
      ...ready,
      liveCapabilities: ['session.cloud', 'session.cloud.codex'] as const,
      installedTools: ['git', 'codex'],
    };
    expect(hostStartsCloud(codexReady, 'codex')).toBe(true);
    // A runner from before Codex cloud would refuse it.
    expect(hostStartsCloud({ ...codexReady, liveCapabilities: ['session.cloud'] }, 'codex')).toBe(
      false,
    );
    expect(hostStartsCloud({ ...codexReady, installedTools: ['git', 'claude'] }, 'codex')).toBe(
      false,
    );
    // Claude Code's cloud asks for claude, which this host lacks.
    expect(hostStartsCloud(codexReady, 'claude-code')).toBe(false);
  });

  it('does not rule out a host with no inventory yet', () => {
    expect(hostStartsCloud({ ...ready, installedTools: null }, 'claude-code')).toBe(true);
  });
});
