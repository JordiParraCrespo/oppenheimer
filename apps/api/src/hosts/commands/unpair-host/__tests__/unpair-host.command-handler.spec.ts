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
});
