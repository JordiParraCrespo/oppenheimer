import { describe, expect, it } from 'vitest';
import { type HostCapabilities, HostEntity } from '../domain/host.entity';
import { HostMapper } from '../host.mapper';

function host(unpairedAt: Date | null = null, capabilities: HostCapabilities | null = null) {
  return HostEntity.create({
    id: 'host-1',
    props: {
      ownerUserId: 'jordi',
      name: 'optimus',
      hostname: 'optimus',
      os: 'ubuntu 24.04',
      arch: 'amd64',
      runnerVersion: '0.14.2',
      capabilities,
      publicKey: 'a'.repeat(44),
      publicKeyFingerprint: 'f'.repeat(64),
      lastSeenAt: new Date(),
      unpairedAt,
    },
  });
}

describe('HostMapper.toResponse', () => {
  const mapper = new HostMapper();

  it('carries the running count and the status read off it', () => {
    const dto = mapper.toResponse(host(), { online: true, runningSessions: 2 });

    expect(dto.runningSessionCount).toBe(2);
    expect(dto.status).toBe('running');
  });

  it('reads a host with no view as offline with nothing running', () => {
    const dto = mapper.toResponse(host());

    expect(dto).toMatchObject({ online: false, runningSessionCount: 0, status: 'offline' });
  });

  it('reads a removed host as unpaired', () => {
    const dto = mapper.toResponse(host(new Date()), { online: true, runningSessions: 0 });

    expect(dto.status).toBe('unpaired');
  });

  it('does not offer Claude Code cloud from a host whose runner probed for claude and did not find it', () => {
    const tools = (claude: { path?: string }) => ({
      tools: [
        { name: 'git', path: '/usr/bin/git', required: true },
        { name: 'claude', required: false, ...claude },
      ],
    });
    const view = { online: true, liveCapabilities: ['session.cloud'] as const };

    expect(mapper.toResponse(host(null, tools({})), view).startsCloudSessions).toBe(false);
    expect(
      mapper.toResponse(host(null, tools({ path: '/usr/local/bin/claude' })), view)
        .startsCloudSessions,
    ).toBe(true);
  });

  it('names the claude.ai account the host’s claude is signed in as, and none without one', () => {
    expect(mapper.toResponse(host(null, { claudeAccount: 'ana@example.com' })).claudeAccount).toBe(
      'ana@example.com',
    );
    expect(mapper.toResponse(host(null, { tools: [] })).claudeAccount).toBeNull();
    expect(mapper.toResponse(host()).claudeAccount).toBeNull();
  });
});
