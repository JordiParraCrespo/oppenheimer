import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { InstallStateResolver } from '../../application/install-state.resolver';
import type { GithubInstallationRepositoryPort } from '../../database/github-installation.repository.port';
import { GithubErrors } from '../../domain/github.errors';
import { GithubInstallationEntity } from '../../domain/github-installation.entity';
import { GITHUB_APP, GITHUB_INSTALLATION_REPOSITORY } from '../../github.di-tokens';
import { GithubInstallationMapper } from '../../github-installation.mapper';
import type { GithubAppPort, GithubInstallationClaim } from '../../infrastructure/github-app.port';
import { ConnectInstallationCommand } from './connect-installation.command';

/**
 * Most of this handler is the proof, in two halves, with no fallback for
 * either. The install `state` proves this console user started this install
 * in this workspace (see `InstallStateResolver`). The OAuth `code` proves
 * which GitHub account can see the installation: exchanging it and asking
 * GitHub is the only thing that stops a forged id handing out one-hour tokens
 * to another account's repositories (`product/versions/mvp/10-api-modules-and-data-model.md`).
 *
 * A claim is something a workspace *holds*: a live row elsewhere is a
 * conflict, this workspace's own disconnected row is revived, and another
 * workspace's disconnected row is history a new row sits beside.
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
    private readonly installState: InstallStateResolver,
  ) {}

  async execute(command: ConnectInstallationCommand): Promise<AggregateID> {
    // First, and spent even if GitHub then fails: one state buys one attempt.
    await this.installState.redeem(command.state, command.userId, command.organizationId);
    const claim = await this.proveClaim(command);

    const live = await this.installations.findLiveByGithubInstallationId(
      command.githubInstallationId,
    );
    if (live.isSome()) {
      const installation = live.unwrap();
      // A live claim, held by the partial unique index (the insert reports a race).
      if (installation.organizationId !== command.organizationId) {
        throw new AppError(GithubErrors.INSTALLATION_ALREADY_CONNECTED, {
          detail: 'Disconnect it from the workspace that holds it, or uninstall the App on GitHub.',
          extensions: { githubInstallationId: command.githubInstallationId },
        });
      }
      // Re-posting the redirect is how a changed repository selection, a changed
      // account name, and a changed suspension reach us.
      return this.refresh(installation, claim, command.userId);
    }

    const disconnected = await this.installations.findDisconnectedForOrganization(
      command.organizationId,
      command.githubInstallationId,
    );
    if (disconnected.isSome()) {
      return this.refresh(disconnected.unwrap(), claim, command.userId);
    }

    const installation = GithubInstallationEntity.connect({
      organizationId: command.organizationId,
      githubInstallationId: claim.githubInstallationId,
      accountLogin: claim.accountLogin,
      accountType: claim.accountType,
      repositorySelection: claim.repositorySelection,
      installedByUserId: command.userId,
      suspendedAt: claim.suspendedAt,
    });

    await this.installations.insert(installation);
    return installation.id;
  }

  private async refresh(
    installation: GithubInstallationEntity,
    claim: GithubInstallationClaim,
    userId: string,
  ): Promise<AggregateID> {
    installation.reconnect(this.mapper.toRefreshProps(claim, userId));
    await this.installations.save(installation);
    return installation.id;
  }

  /** The claimed installation: proven visible, then read from GitHub. */
  private async proveClaim(command: ConnectInstallationCommand): Promise<GithubInstallationClaim> {
    if (!this.github.isConfigured()) {
      throw new AppError(GithubErrors.APP_NOT_CONFIGURED);
    }

    const visible = await this.github.listUserInstallations(command.code);
    const canSee = visible.some(
      (candidate) => candidate.githubInstallationId === command.githubInstallationId,
    );
    if (!canSee) {
      throw new AppError(GithubErrors.INSTALLATION_NOT_CLAIMABLE, {
        detail: `GitHub does not list installation ${command.githubInstallationId} for the authorizing account`,
        extensions: { githubInstallationId: command.githubInstallationId },
      });
    }

    return this.github.readInstallation(command.githubInstallationId);
  }
}
