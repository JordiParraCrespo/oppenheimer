import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { HostUpdatePort } from '../../application/host-update.port';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import { HostErrors } from '../../domain/hosts.errors';
import { HOST_REPOSITORY, HOST_UPDATE } from '../../hosts.di-tokens';
import { RunnerReleaseConfig } from '../../infrastructure/runner-release.config';
import { UpdateHostRunnerCommand } from './update-host-runner.command';

/**
 * The console's Update runner: ask a connected host to install the newest
 * release on this deployment's channel now, rather than at its next check and
 * quiet moment (`product/versions/mvp/09-runner-install-and-update.md` §5).
 *
 * Writes nothing. The host's version on its row changes when the updated
 * runner says hello again; a pinned host stays on its pin.
 */
@CommandHandler(UpdateHostRunnerCommand)
export class UpdateHostRunnerCommandHandler
  implements ICommandHandler<UpdateHostRunnerCommand, void>
{
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
    @Inject(HOST_UPDATE)
    private readonly updates: HostUpdatePort,
    private readonly release: RunnerReleaseConfig,
  ) {}

  async execute(command: UpdateHostRunnerCommand): Promise<void> {
    const found = await this.hosts.findOneById(command.scope, command.hostId);
    if (found.isNone() || found.unwrap().isUnpaired) {
      throw new AppError(HostErrors.NOT_FOUND, { detail: `No host with id ${command.hostId}` });
    }

    const outcome = this.updates.request(command.hostId, this.release.channel);
    if (outcome.kind === 'host_offline') {
      throw new AppError(HostErrors.OFFLINE, {
        detail: 'The host is not connected; its runner updates itself the next time it is.',
      });
    }
  }
}
