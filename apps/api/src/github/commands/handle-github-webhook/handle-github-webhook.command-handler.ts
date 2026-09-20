import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type {
  GithubInstallationRepositoryPort,
  InstallationStatusChange,
} from '../../database/github-installation.repository.port';
import { GithubErrors } from '../../domain/github.errors';
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
 *
 * It writes through a **conditional update rather than the aggregate**. Loading
 * the row, mutating it and saving it back would let a delivery that read the
 * world a moment before a disconnect committed write the whole row again,
 * `deletedAt` included, and resurrect a claim the workspace had given up.
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

    // Keyed by GitHub's own id and matched across every workspace: a delivery
    // arrives with no notion of our tenants. Only a live row is touched — a
    // disconnected one is history, and GitHub's news about it changes nothing.
    const applied = await this.installations.applyStatusChange({
      githubInstallationId: delivery.githubInstallationId,
      ...changeFor(delivery.action),
    });

    if (!applied) {
      this.logger.warn({
        message: 'Ignoring an installation webhook for an installation no workspace holds',
        githubInstallationId: delivery.githubInstallationId,
        action: delivery.action,
      });
    }
  }

  private get webhookSecret(): string | undefined {
    return this.configService.get<string>('githubApp.webhookSecret');
  }
}

/** Only the columns the action is about. Everything else is left alone. */
function changeFor(
  action: InstallationWebhookAction,
): Omit<InstallationStatusChange, 'githubInstallationId'> {
  if (action === 'suspend') return { suspendedAt: new Date() };
  if (action === 'unsuspend') return { suspendedAt: null };
  return { deletedAt: new Date() };
}
