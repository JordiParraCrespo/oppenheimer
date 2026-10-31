import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import {
  type AggregateID,
  retryOnVersionConflict,
  VersionConflictException,
} from '@oppenheimer/backend-ddd';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import { HostErrors } from '../../domain/hosts.errors';
import { HOST_REPOSITORY } from '../../hosts.di-tokens';
import { RenameHostCommand } from './rename-host.command';

/**
 * Display only: no directory, branch or path on any machine is derived from a
 * host's name, so this is free and needs no coordination with the runner.
 *
 * A rename that loses to another write of the host (an unpair, the machine's
 * uninstall, another rename) is made again once on a fresh read, so the name
 * lands on the host as it now is and never puts back what the other write
 * changed. Losing twice answers `HOSTS_009`.
 */
@CommandHandler(RenameHostCommand)
export class RenameHostCommandHandler implements ICommandHandler<RenameHostCommand, AggregateID> {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
  ) {}

  async execute(command: RenameHostCommand): Promise<AggregateID> {
    try {
      return await retryOnVersionConflict(async () => {
        const found = await this.hosts.findOneById(command.scope, command.hostId);
        if (found.isNone()) {
          throw new AppError(HostErrors.NOT_FOUND, { detail: `No host with id ${command.hostId}` });
        }
        const host = found.unwrap();
        host.rename(command.name);
        await this.hosts.save(host);
        return host.id;
      });
    } catch (error) {
      if (!(error instanceof VersionConflictException)) throw error;
      throw new AppError(HostErrors.CHANGED_CONCURRENTLY, {
        detail: `Host ${command.hostId} was written by someone else twice while it was renamed`,
      });
    }
  }
}
