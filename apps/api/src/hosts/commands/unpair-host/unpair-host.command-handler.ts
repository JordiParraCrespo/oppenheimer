import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { retryHostWrite } from '../../application/host-write-retry.policy';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import { HostErrors } from '../../domain/hosts.errors';
import { HOST_REPOSITORY } from '../../hosts.di-tokens';
import { UnpairHostCommand } from './unpair-host.command';

/**
 * Unpairs a host at the owner's request (`DELETE /v1/hosts/{id}`): the person
 * no longer wants this machine to be given work.
 *
 * The row is kept, with `unpairedAt` set. Unpairing never deletes a host — the
 * pairing history, the key that was trusted and the sessions that ran on it all
 * reference this row, and a machine whose runner is still running needs
 * something to authenticate against in order to be told it is gone.
 *
 * `wipe` is the dialog's "also clean up this machine": the host is told, as its
 * link closes, to close every session rather than only stop it. A host with no
 * link open at that moment is not told, so the console offers it only while the
 * host is online.
 *
 * **Idempotent.** A host already unpaired is left as it is, and an unpair that
 * loses to another write is decided again on a fresh read: when that write was
 * the machine's own uninstall, the host is already unpaired and nothing more is
 * written, so `HostUnpaired` is raised and put on the timeline once. A `wipe`
 * asked for then is not sent: the link already closed without it. Losing twice
 * answers `HOSTS_009`.
 */
@CommandHandler(UnpairHostCommand)
export class UnpairHostCommandHandler implements ICommandHandler<UnpairHostCommand, AggregateID> {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
  ) {}

  async execute(command: UnpairHostCommand): Promise<AggregateID> {
    await retryHostWrite(command.hostId, async () => {
      const found = await this.hosts.findOneById(command.scope, command.hostId);
      if (found.isNone()) {
        throw new AppError(HostErrors.NOT_FOUND, { detail: `No host with id ${command.hostId}` });
      }
      const host = found.unwrap();
      if (host.isUnpaired) return;
      host.unpair(new Date(), { wipe: command.wipe });
      await this.hosts.save(host);
    });
    return command.hostId;
  }
}
