import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { GithubInstallationRepositoryPort } from '../../database/github-installation.repository.port';
import { GithubErrors } from '../../domain/github.errors';
import type { GithubInstallationEntity } from '../../domain/github-installation.entity';
import { GITHUB_INSTALLATION_REPOSITORY } from '../../github.di-tokens';
import {
  type InstallationWebhookAction,
  parseInstallationEvent,
  verifyWebhookSignature,
} from '../../infrastructure/github-webhook.util';
import { HandleGithubWebhookCommand } from './handle-github-webhook.command';

/**
 * The `installation` webhook: suspend, unsuspend, uninstall.
 *
 * Those are the three facts about an installation that change without us and
 * that a token mint has to respect, and they are the only reason this module
 * subscribes to anything. Nothing here mirrors the repository set, so there is
 * no `installation_repositories` subscription and nothing to resync.
 *
 * Each delivery is a status write and is idempotent to repeat, which is why
 * there is no delivery table and no de-duplication key.
 */
@CommandHandler(HandleGithubWebhookCommand)
export class HandleGithubWebhookCommandHandler
  implements ICommandHandler<HandleGithubWebhookCommand, void>
{
  private readonly logger = new Logger(HandleGithubWebhookCommandHandler.name);

  constructor(
    @Inject(GITHUB_INSTALLATION_REPOSITORY)
    private readonly installations: GithubInstallationRepositoryPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: HandleGithubWebhookCommand): Promise<void> {
    if (!this.webhookSecret) {
      throw new AppError(GithubErrors.APP_NOT_CONFIGURED, {
        detail: 'Set GITHUB_APP_WEBHOOK_SECRET before pointing GitHub at this endpoint.',
      });
    }
    if (!verifyWebhookSignature(this.webhookSecret, command.payload, command.signature)) {
      throw new AppError(GithubErrors.WEBHOOK_SIGNATURE_INVALID);
    }

    const delivery = parseInstallationEvent(command.event, command.payload);
    if (delivery.type === 'ignored') return;

    // The lookup is by GitHub's own id and across every workspace: a delivery
    // arrives with no notion of our tenants, and refusing to find the row would
    // leave the installation looking usable after it was suspended.
    const found = await this.installations.findOneByGithubInstallationId(
      delivery.githubInstallationId,
    );
    if (found.isNone()) {
      this.logger.warn({
        message: 'Ignoring an installation webhook for an installation no workspace connected',
        githubInstallationId: delivery.githubInstallationId,
      });
      return;
    }

    const installation = found.unwrap();
    apply(installation, delivery.action);
    await this.installations.save(installation);
  }

  private get webhookSecret(): string | undefined {
    return this.configService.get<string>('githubApp.webhookSecret');
  }
}

function apply(installation: GithubInstallationEntity, action: InstallationWebhookAction): void {
  if (action === 'suspend') installation.suspend();
  if (action === 'unsuspend') installation.unsuspend();
  if (action === 'delete') installation.markUninstalled();
}
