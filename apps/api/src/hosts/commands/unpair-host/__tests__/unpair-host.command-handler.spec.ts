import { VersionConflictException } from '@oppenheimer/backend-ddd';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessScope } from '../../../../authz/domain/access-scope.types';
import type { HostRepositoryPort } from '../../../database/host.repository.port';
import { HostUnpairedDomainEvent } from '../../../domain/events/host-unpaired.domain-event';
import { HostEntity } from '../../../domain/host.entity';
import { UnpairHostCommand } from '../unpair-host.command';
import { UnpairHostCommandHandler } from '../unpair-host.command-handler';

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

  const command = (wipe = false) =>
    new UnpairHostCommand({ scope: scope(), hostId: 'host-1', wipe });

  it('marks the host unpaired and keeps the row', async () => {
    await handler.execute(command());

    const [saved] = vi.mocked(hosts.save).mock.calls[0];
    expect(saved.unpairedAt).toBeInstanceOf(Date);
    expect(saved.id).toBe('host-1');
  });

  it('carries the owner’s clean-up request on the unpaired event', async () => {
    await handler.execute(command(true));

    const [saved] = vi.mocked(hosts.save).mock.calls[0];
    const [event] = saved.domainEvents;
    expect(event).toBeInstanceOf(HostUnpairedDomainEvent);
    expect(event).toMatchObject({ wipe: true });
  });

  it('reports a host outside the caller’s scope as missing', async () => {
    vi.mocked(hosts.findOneById).mockResolvedValue(None);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_001' });
  });

  it('writes nothing for a host that is already unpaired', async () => {
    vi.mocked(hosts.findOneById).mockResolvedValue(Some(host(new Date())));

    await expect(handler.execute(command())).resolves.toBe('host-1');
    expect(hosts.save).not.toHaveBeenCalled();
  });

  it('writes nothing more when the machine’s uninstall unpaired it first', async () => {
    vi.mocked(hosts.findOneById)
      .mockResolvedValueOnce(Some(host()))
      .mockResolvedValueOnce(Some(host(new Date())));
    vi.mocked(hosts.save).mockRejectedValueOnce(new VersionConflictException('stale'));

    await expect(handler.execute(command())).resolves.toBe('host-1');
    // Only the losing attempt reached save; the unpair is raised once, by the winner.
    expect(hosts.save).toHaveBeenCalledTimes(1);
  });

  it('answers HOSTS_009 when it loses on the retry too', async () => {
    vi.mocked(hosts.findOneById).mockImplementation(async () => Some(host()));
    vi.mocked(hosts.save).mockRejectedValue(new VersionConflictException('stale'));

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_009' });
    expect(hosts.save).toHaveBeenCalledTimes(2);
  });
});
