import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { retryHostWrite } from '../../application/host-write-retry.policy';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import { HOST_REPOSITORY } from '../../hosts.di-tokens';
import { UninstallHostCommand } from './uninstall-host.command';

/**
 * The uninstall half of pairing: the runner has been removed and says so with its
 * daemon already stopped, hence an HTTP call rather than a frame on the link.
 *
 * **Idempotent, including for a host already gone.** The runner treats a 404 as
 * success, since it cannot tell "never here" from "already removed" and neither side
 * could act differently. A host the console unpaired first, or whose row is gone, is
 * no error: the machine's copy of the identity is deleted and the state it asks for
 * holds. That includes an unpair that lands between this read and this write: the
 * write loses, the fresh read finds the host unpaired, and `HostUnpaired` is raised
 * once. Losing twice answers `HOSTS_009`.
 */
@CommandHandler(UninstallHostCommand)
export class UninstallHostCommandHandler implements ICommandHandler<UninstallHostCommand, void> {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
  ) {}

  async execute(command: UninstallHostCommand): Promise<void> {
    await retryHostWrite(command.hostId, async () => {
      const found = await this.hosts.findOneByIdForMachine(command.hostId);
      if (found.isNone()) return;
      const host = found.unwrap();
      if (host.isUnpaired) return;
      host.unpair();
      await this.hosts.save(host);
    });
  }
}
