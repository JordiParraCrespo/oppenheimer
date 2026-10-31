import type { AccessScope } from '@oppenheimer/backend-authz';
import { VersionConflictException } from '@oppenheimer/backend-ddd';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostRepositoryPort } from '../../../database/host.repository.port';
import { HostEntity } from '../../../domain/host.entity';
import { RenameHostCommand } from '../rename-host.command';
import { RenameHostCommandHandler } from '../rename-host.command-handler';

function scope(): AccessScope {
  return { userId: 'jordi', organizationId: null, teamIds: [], grants: new Map(), bypass: false };
}

function host(unpairedAt: Date | null = null) {
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
      unpairedAt,
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

  it('renames again from a fresh read when another write landed first, keeping what it changed', async () => {
    const unpairedAt = new Date('2026-10-31T10:00:00Z');
    vi.mocked(hosts.findOneById)
      .mockResolvedValueOnce(Some(host()))
      .mockResolvedValueOnce(Some(host(unpairedAt)));
    vi.mocked(hosts.save).mockRejectedValueOnce(new VersionConflictException('stale'));

    await expect(handler.execute(command())).resolves.toBe('host-1');

    expect(hosts.save).toHaveBeenCalledTimes(2);
    const [retried] = vi.mocked(hosts.save).mock.calls[1];
    expect(retried.name).toBe('Laptop');
    expect(retried.unpairedAt).toEqual(unpairedAt);
  });

  it('answers HOSTS_009 when it loses on the retry too', async () => {
    vi.mocked(hosts.findOneById).mockImplementation(async () => Some(host()));
    vi.mocked(hosts.save).mockRejectedValue(new VersionConflictException('stale'));

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_009' });
    expect(hosts.save).toHaveBeenCalledTimes(2);
  });
});
