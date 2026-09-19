import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import { HostEntity } from '../../domain/host.entity';
import { HostAccessResolver } from '../host-access.resolver';

/**
 * What `sessions/` will inject to check a caller may put work on a host.
 *
 * `work_session.hostId` is the one reference in the schema a foreign key cannot
 * hold — a host has no workspace column and a grant is a row, not a column — so
 * this check is what stands in for the constraint, and it has to refuse the same
 * way a missing row would.
 */

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

function host(unpairedAt: Date | null = null): HostEntity {
  return HostEntity.create({
    id: 'host-1',
    props: {
      ownerUserId: 'jordi',
      name: 'Dev box',
      hostname: null,
      os: null,
      arch: null,
      runnerVersion: null,
      capabilities: null,
      publicKey: 'a'.repeat(44),
      publicKeyFingerprint: FINGERPRINT,
      previousPublicKey: null,
      previousPublicKeyFingerprint: null,
      previousPublicKeyExpiresAt: null,
      lastSeenAt: null,
      unpairedAt,
    },
  });
}

describe('HostAccessResolver', () => {
  let hosts: Pick<HostRepositoryPort, 'findOneById'>;
  let resolver: HostAccessResolver;

  beforeEach(() => {
    hosts = { findOneById: vi.fn().mockResolvedValue(Some(host())) };
    resolver = new HostAccessResolver(hosts as HostRepositoryPort);
  });

  it('admits a host the caller can reach', async () => {
    await expect(resolver.assertUsable(scope(), 'host-1')).resolves.toBeUndefined();
    // Reached through the *scoped* read, so it is the same predicate the listing
    // uses: a host a caller cannot see is one they cannot name either.
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
    // Telling the two apart would confirm an id to someone who cannot reach it.
    vi.mocked(hosts.findOneById).mockResolvedValue(Some(host(new Date())));

    await expect(resolver.assertUsable(scope(), 'host-1')).rejects.toMatchObject({
      code: 'HOSTS_001',
    });
  });
});
