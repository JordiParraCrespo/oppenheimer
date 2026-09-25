import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import { HostErrors } from '../../domain/hosts.errors';
import { HOST_REPOSITORY } from '../../hosts.di-tokens';
import { UnpairHostCommand } from './unpair-host.command';

/**
 * Unpairs a host at the owner's request (`DELETE /v1/hosts/{id}`): the person
 * no longer wants this machine to be given work.
 *
 * The row is kept, with `unpairedAt` set. Hosts are never hard-deleted — the
 * pairing history, the key that was trusted and the sessions that ran on it all
 * reference this row, and a machine whose runner is still running needs
 * something to authenticate against in order to be told it is gone.
 */
@CommandHandler(UnpairHostCommand)
export class UnpairHostCommandHandler implements ICommandHandler<UnpairHostCommand, AggregateID> {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
  ) {}

  async execute(command: UnpairHostCommand): Promise<AggregateID> {
    const found = await this.hosts.findOneById(command.scope, command.hostId);
    if (found.isNone()) {
      throw new AppError(HostErrors.NOT_FOUND, { detail: `No host with id ${command.hostId}` });
    }

    const host = found.unwrap();
    host.unpair();
    await this.hosts.save(host);

    return host.id;
  }
}
