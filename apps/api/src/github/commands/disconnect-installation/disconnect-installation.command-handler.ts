import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { GithubInstallationRepositoryPort } from '../../database/github-installation.repository.port';
import { GithubErrors } from '../../domain/github.errors';
import { GITHUB_INSTALLATION_REPOSITORY } from '../../github.di-tokens';
import { DisconnectInstallationCommand } from './disconnect-installation.command';

/**
 * Gives up a workspace's claim on an installation.
 *
 * The row is kept and marked rather than deleted, for two reasons: GitHub still
 * has the installation — uninstalling is a thing the user does there — and a
 * checkout that recorded this installation id needs it to keep resolving to
 * something that can explain why its repository stopped working. Re-running the
 * install redirect revives the same row.
 */
@CommandHandler(DisconnectInstallationCommand)
export class DisconnectInstallationCommandHandler
  implements ICommandHandler<DisconnectInstallationCommand, AggregateID>
{
  constructor(
    @Inject(GITHUB_INSTALLATION_REPOSITORY)
    private readonly installations: GithubInstallationRepositoryPort,
  ) {}

  async execute(command: DisconnectInstallationCommand): Promise<AggregateID> {
    const found = await this.installations.findOneById(command.scope, command.installationId);
    if (found.isNone()) {
      throw new AppError(GithubErrors.INSTALLATION_NOT_FOUND, {
        detail: `No GitHub installation with id ${command.installationId}`,
      });
    }

    const installation = found.unwrap();
    installation.disconnect();
    await this.installations.save(installation);
    return installation.id;
  }
}
