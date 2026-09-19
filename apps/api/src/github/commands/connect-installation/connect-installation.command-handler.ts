import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { GithubInstallationRepositoryPort } from '../../database/github-installation.repository.port';
import { GithubErrors } from '../../domain/github.errors';
import { GithubInstallationEntity } from '../../domain/github-installation.entity';
import { GITHUB_APP, GITHUB_INSTALLATION_REPOSITORY } from '../../github.di-tokens';
import { GithubInstallationMapper } from '../../github-installation.mapper';
import type { GithubAppPort, GithubInstallationClaim } from '../../infrastructure/github-app.port';
import { ConnectInstallationCommand } from './connect-installation.command';

/**
 * Claims a GitHub App installation for the caller's workspace.
 *
 * The whole of this handler is the proof. The App is configured to request user
 * authorization during installation, so the redirect carries an OAuth `code`
 * beside the `installation_id`; exchanging it and asking GitHub which
 * installations that account can see is the only thing that stops a forged id
 * handing out one-hour tokens to another account's repositories
 * (`product/09-github-app-install.md` §1). There is no fallback: matching the
 * installation's account login against the caller's linked GitHub account fails
 * for organization installations, where that login is the org and not a user.
 */
@CommandHandler(ConnectInstallationCommand)
export class ConnectInstallationCommandHandler
  implements ICommandHandler<ConnectInstallationCommand, AggregateID>
{
  constructor(
    @Inject(GITHUB_INSTALLATION_REPOSITORY)
    private readonly installations: GithubInstallationRepositoryPort,
    @Inject(GITHUB_APP)
    private readonly github: GithubAppPort,
    private readonly mapper: GithubInstallationMapper,
  ) {}

  async execute(command: ConnectInstallationCommand): Promise<AggregateID> {
    const claim = await this.proveClaim(command);
    const existing = await this.installations.findOneByGithubInstallationId(
      command.githubInstallationId,
    );

    if (existing.isSome()) {
      const installation = existing.unwrap();
      // `githubInstallationId` is globally unique, so this is the only place a
      // second workspace can be told no — and it must be told, or the insert
      // below would surface a constraint violation as a 500.
      if (installation.organizationId !== command.organizationId) {
        throw new AppError(GithubErrors.INSTALLATION_ALREADY_CONNECTED, {
          detail: 'Uninstall the App from that GitHub account before connecting it here.',
          extensions: { githubInstallationId: command.githubInstallationId },
        });
      }

      // Re-running the install redirect is how a workspace reconnects, and how
      // a changed repository selection reaches us. Same row, refreshed.
      installation.reconnect(this.mapper.toRefreshProps(claim, command.userId));
      await this.installations.save(installation);
      return installation.id;
    }

    const installation = GithubInstallationEntity.connect({
      organizationId: command.organizationId,
      githubInstallationId: claim.githubInstallationId,
      accountLogin: claim.accountLogin,
      accountType: claim.accountType,
      repositorySelection: claim.repositorySelection,
      installedByUserId: command.userId,
    });

    await this.installations.insert(installation);
    return installation.id;
  }

  /** The claimed installation, as GitHub reports it to the authorizing account. */
  private async proveClaim(command: ConnectInstallationCommand): Promise<GithubInstallationClaim> {
    if (!this.github.isConfigured()) {
      throw new AppError(GithubErrors.APP_NOT_CONFIGURED);
    }

    const visible = await this.github.listUserInstallations(command.code);
    const claim = visible.find(
      (candidate) => candidate.githubInstallationId === command.githubInstallationId,
    );
    if (!claim) {
      throw new AppError(GithubErrors.INSTALLATION_NOT_CLAIMABLE, {
        detail: `GitHub does not list installation ${command.githubInstallationId} for the authorizing account`,
        extensions: { githubInstallationId: command.githubInstallationId },
      });
    }
    return claim;
  }
}
