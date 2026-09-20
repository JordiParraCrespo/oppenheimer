import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostRepositoryPort } from '../../../database/host.repository.port';
import { HostEntity } from '../../../domain/host.entity';
import { RenameHostCommand } from '../rename-host.command';
import { RenameHostCommandHandler } from '../rename-host.command-handler';

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
      lastSeenAt: null,
      unpairedAt: null,
    },
  });
}

describe('RenameHostCommandHandler', () => {
  let hosts: Pick<HostRepositoryPort, 'findOneById' | 'save'>;
  let handler: RenameHostCommandHandler;

  beforeEach(() => {
    hosts = {
      findOneById: vi.fn().mockResolvedValue(Some(host())),
      save: vi.fn(async (entity) => entity),
    };
    handler = new RenameHostCommandHandler(hosts as HostRepositoryPort);
  });

  const command = (name = 'Laptop') =>
    new RenameHostCommand({ scope: scope(), hostId: 'host-1', name });

  it('renames the host it can reach', async () => {
    await handler.execute(command());

    const [saved] = vi.mocked(hosts.save).mock.calls[0];
    expect(saved.name).toBe('Laptop');
  });

  it('reports a host outside the caller’s scope as missing', async () => {
    vi.mocked(hosts.findOneById).mockResolvedValue(None);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_001' });
  });
});
