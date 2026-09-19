import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import { HOST_REPOSITORY } from '../../hosts.di-tokens';
import { UninstallHostCommand } from './uninstall-host.command';

/**
 * The uninstall half of pairing: the runner has been removed from the machine
 * and is saying so, with the daemon already stopped — which is why this is an
 * HTTP call rather than a frame on the link.
 *
 * **Idempotent by design, including for a host that is already gone.** The
 * runner treats a 404 as success because it has no way to tell "you were never
 * here" from "you have already been removed", and there is nothing either side
 * could usefully do differently. So a host the console unpaired first, or one
 * whose row is gone entirely, is not an error here: the machine's own copy of
 * the identity is already deleted, and the state it is asking for is the state
 * that holds.
 */
@CommandHandler(UninstallHostCommand)
export class UninstallHostCommandHandler implements ICommandHandler<UninstallHostCommand, void> {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
  ) {}

  async execute(command: UninstallHostCommand): Promise<void> {
    // No access scope: the caller is the host itself, identified by the
    // signature on its assertion rather than by a person's membership.
    const found = await this.hosts.findOneByIdForMachine(command.hostId);
    if (found.isNone()) return;

    const host = found.unwrap();
    if (host.isUnpaired) return;

    host.unpair();
    await this.hosts.save(host);
  }
}
