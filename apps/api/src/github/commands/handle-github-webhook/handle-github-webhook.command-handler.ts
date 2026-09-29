import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { ReceiveInboundDeliveryCommand } from '../../../inbound-events/commands/receive-inbound-delivery/receive-inbound-delivery.command';
import type { GithubInstallationRepositoryPort } from '../../database/github-installation.repository.port';
import { GithubErrors } from '../../domain/github.errors';
import { GITHUB_INSTALLATION_REPOSITORY } from '../../github.di-tokens';
import {
  installationStatusChange,
  parseDeliveryBody,
  parseInstallationEvent,
  payloadDigest,
  verifyWebhookSignature,
} from '../../infrastructure/github-webhook.util';
import { HandleGithubWebhookCommand } from './handle-github-webhook.command';

/**
 * The App's one webhook endpoint, verified once, then split in two.
 *
 * **`installation`** — suspend, unsuspend, uninstall — is this module's own:
 * the three facts about an installation that change without us and that a
 * token mint has to respect. Each is a status write, idempotent to repeat and
 * ordered by GitHub's own time, so a late retry cannot undo a newer change.
 *
 * **Every other event** is handed to the inbound-events hub
 * (`product/versions/mvp/16-automations-architecture.md` §Q6), which stores it
 * keyed by GitHub's delivery id and normalizes it for automations. One
 * endpoint and one secret for the App, whatever consumes its events.
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
    private readonly commandBus: CommandBus,
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

    if (command.event !== 'installation') {
      await this.handToHub(command);
      return;
    }

    const delivery = parseInstallationEvent(command.event, command.payload);
    if (delivery.type === 'ignored') return;

    const facts = { githubInstallationId: delivery.githubInstallationId, action: delivery.action };
    if (!delivery.occurredAt) {
      this.logger.warn({
        message: 'Installation webhook carries no time; using receipt',
        ...facts,
      });
    }
    const result = await this.installations.applyStatusChange(
      installationStatusChange(delivery, new Date()),
    );

    if (result === 'missing') {
      this.logger.warn({
        message: 'Ignoring an installation webhook for an installation no workspace holds',
        ...facts,
      });
    } else if (result === 'stale') {
      this.logger.log({ message: 'Ignoring an out-of-order installation webhook', ...facts });
    }
  }

  /**
   * A verified delivery the hub stores and normalizes. A body that is not a
   * JSON object is dropped. The digest is of the raw bytes (see
   * `payloadDigest`): the same signed bytes are one delivery, whatever id the
   * unsigned `X-GitHub-Delivery` header claims.
   */
  private async handToHub(command: HandleGithubWebhookCommand): Promise<void> {
    const body = parseDeliveryBody(command.payload);
    if (!body) return;
    await this.commandBus.execute(
      new ReceiveInboundDeliveryCommand({
        source: 'github',
        deliveryId: command.deliveryId,
        eventName: command.event,
        payload: body,
        payloadDigest: payloadDigest(command.payload),
      }),
    );
  }

  private get webhookSecret(): string | undefined {
    return this.configService.get<string>('githubApp.webhookSecret');
  }
}
