import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostRepositoryPort } from '../../../database/host.repository.port';
import { HostEntity } from '../../../domain/host.entity';
import { UninstallHostCommand } from '../uninstall-host.command';
import { UninstallHostCommandHandler } from '../uninstall-host.command-handler';

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

describe('UninstallHostCommandHandler', () => {
  let hosts: Pick<HostRepositoryPort, 'findOneByIdForMachine' | 'save'>;
  let handler: UninstallHostCommandHandler;

  beforeEach(() => {
    hosts = {
      findOneByIdForMachine: vi.fn().mockResolvedValue(Some(host())),
      save: vi.fn(async (entity) => entity),
    };
    handler = new UninstallHostCommandHandler(hosts as HostRepositoryPort);
  });

  const command = () => new UninstallHostCommand({ hostId: 'host-1' });

  it('unpairs the calling host', async () => {
    await handler.execute(command());

    const [saved] = vi.mocked(hosts.save).mock.calls[0];
    expect(saved.unpairedAt).toBeInstanceOf(Date);
  });

  it('reads the host without an access scope, because the caller is the machine', async () => {
    await handler.execute(command());

    expect(hosts.findOneByIdForMachine).toHaveBeenCalledWith('host-1');
  });

  it('succeeds for a host the console already unpaired', async () => {
    // The runner cannot tell "you were never here" from "you have already been
    // removed", and neither side would do anything differently, so this answers
    // the same way twice rather than inventing a conflict.
    vi.mocked(hosts.findOneByIdForMachine).mockResolvedValue(Some(host(new Date())));

    await expect(handler.execute(command())).resolves.toBeUndefined();
    expect(hosts.save).not.toHaveBeenCalled();
  });

  it('succeeds for a host whose row is gone', async () => {
    vi.mocked(hosts.findOneByIdForMachine).mockResolvedValue(None);

    await expect(handler.execute(command())).resolves.toBeUndefined();
    expect(hosts.save).not.toHaveBeenCalled();
  });
});
