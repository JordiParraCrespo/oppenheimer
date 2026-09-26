import { describe, expect, it } from 'vitest';
import { HostEntity } from '../domain/host.entity';
import { HostMapper } from '../host.mapper';

function host(unpairedAt: Date | null = null) {
  return HostEntity.create({
    id: 'host-1',
    props: {
      ownerUserId: 'jordi',
      name: 'optimus',
      hostname: 'optimus',
      os: 'ubuntu 24.04',
      arch: 'amd64',
      runnerVersion: '0.14.2',
      capabilities: null,
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
});
