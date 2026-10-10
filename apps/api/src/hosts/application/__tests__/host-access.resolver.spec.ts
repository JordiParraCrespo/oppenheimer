import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import { HostEntity } from '../../domain/host.entity';
import { HostMapper } from '../../host.mapper';
import { HostAccessResolver } from '../host-access.resolver';

const FINGERPRINT = 'f'.repeat(64);

function scope(overrides: Partial<AccessScope> = {}): AccessScope {
  return {
    userId: 'jordi',
    organizationId: 'org-1',
    teamIds: [],
    grants: new Map(),
    bypass: false,
    ...overrides,
  };
}

function host(
  unpairedAt: Date | null = null,
  capabilities: Record<string, unknown> | null = null,
): HostEntity {
  return HostEntity.create({
    id: 'host-1',
    props: {
      ownerUserId: 'jordi',
      name: 'Dev box',
      hostname: null,
      os: null,
      arch: null,
      runnerVersion: null,
      capabilities,
      publicKey: 'a'.repeat(44),
      publicKeyFingerprint: FINGERPRINT,
      lastSeenAt: null,
      unpairedAt,
      maxSessions: null,
    },
  });
}

describe('HostAccessResolver', () => {
  let hosts: Pick<HostRepositoryPort, 'findOneById'>;
  let resolver: HostAccessResolver;

  beforeEach(() => {
    hosts = { findOneById: vi.fn().mockResolvedValue(Some(host())) };
    resolver = new HostAccessResolver(hosts as HostRepositoryPort, new HostMapper());
  });

  it('reports the tool names the runner probed, which say what it can start', async () => {
    vi.mocked(hosts.findOneById).mockResolvedValue(
      Some(
        host(null, {
          tools: [
            { name: 'git', path: '/usr/bin/git', required: true },
            { name: 'grok', required: false },
          ],
        }),
      ),
    );

    await expect(resolver.assertUsable(scope(), 'host-1')).resolves.toEqual({
      probedTools: ['git', 'grok'],
      sessionLimit: null,
    });
  });

  it('reports the session limit the machine’s size gives when none was set', async () => {
    vi.mocked(hosts.findOneById).mockResolvedValue(
      Some(host(null, { cpus: 4, memoryTotalBytes: 7.6 * 1024 ** 3 })),
    );

    await expect(resolver.assertUsable(scope(), 'host-1')).resolves.toMatchObject({
      sessionLimit: 3,
    });
  });

  it('admits a host the caller can reach', async () => {
    await expect(resolver.assertUsable(scope(), 'host-1')).resolves.toEqual({
      probedTools: null,
      sessionLimit: null,
    });
    expect(hosts.findOneById).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'jordi' }),
      'host-1',
    );
  });

  it('refuses a host outside the caller’s scope as missing', async () => {
    vi.mocked(hosts.findOneById).mockResolvedValue(None);

    await expect(resolver.assertUsable(scope(), 'host-1')).rejects.toMatchObject({
      code: 'HOSTS_001',
    });
  });

  it('refuses an unpaired host, and says no more than "missing"', async () => {
    vi.mocked(hosts.findOneById).mockResolvedValue(Some(host(new Date())));

    await expect(resolver.assertUsable(scope(), 'host-1')).rejects.toMatchObject({
      code: 'HOSTS_001',
    });
  });
});
