import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import { HOST_REPOSITORY } from '../../hosts.di-tokens';
import { RenameHostCommand } from './rename-host.command';

/**
 * Display only: no directory, branch or path on any machine is derived from a
 * host's name, so this is free and needs no coordination with the runner.
 */
@CommandHandler(RenameHostCommand)
export class RenameHostCommandHandler implements ICommandHandler<RenameHostCommand, AggregateID> {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
  ) {}

  async execute(command: RenameHostCommand): Promise<AggregateID> {
    const found = await this.hosts.findOneById(command.scope, command.hostId);
    if (found.isNone()) {
      throw new NotFoundException(`No host with id ${command.hostId}`);
    }

    const host = found.unwrap();
    host.rename(command.name);
    await this.hosts.save(host);

    return host.id;
  }
}
