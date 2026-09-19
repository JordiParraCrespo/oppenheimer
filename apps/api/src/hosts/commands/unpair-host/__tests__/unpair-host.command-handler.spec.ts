import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostRepositoryPort } from '../../../database/host.repository.port';
import { HostEntity } from '../../../domain/host.entity';
import { UnpairHostCommand } from '../unpair-host.command';
import { UnpairHostCommandHandler } from '../unpair-host.command-handler';

function scope(): AccessScope {
  return { userId: 'jordi', organizationId: null, teamIds: [], grants: new Map(), bypass: false };
}

function host() {
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
      publicKeyFingerprint: 'f'.repeat(64),
      previousPublicKey: null,
      previousPublicKeyFingerprint: null,
      previousPublicKeyExpiresAt: null,
      lastSeenAt: null,
      unpairedAt: null,
    },
  });
}

describe('UnpairHostCommandHandler', () => {
  let hosts: Pick<HostRepositoryPort, 'findOneById' | 'save'>;
  let handler: UnpairHostCommandHandler;

  beforeEach(() => {
    hosts = {
      findOneById: vi.fn().mockResolvedValue(Some(host())),
      save: vi.fn(async (entity) => entity),
    };
    handler = new UnpairHostCommandHandler(hosts as HostRepositoryPort);
  });

  const command = () => new UnpairHostCommand({ scope: scope(), hostId: 'host-1' });

  it('marks the host unpaired and keeps the row', async () => {
    await handler.execute(command());

    const [saved] = vi.mocked(hosts.save).mock.calls[0];
    // Never a delete: the sessions that ran on this machine reference the row,
    // and its own runner still needs something to authenticate against to be
    // told it is gone.
    expect(saved.unpairedAt).toBeInstanceOf(Date);
    expect(saved.id).toBe('host-1');
  });

  it('reports a host outside the caller’s scope as missing', async () => {
    vi.mocked(hosts.findOneById).mockResolvedValue(None);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_001' });
  });
});
