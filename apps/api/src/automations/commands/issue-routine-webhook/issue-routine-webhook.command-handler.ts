import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, type KeySealer } from '@oppenheimer/backend-core';
import { BotRoutineResolver } from '../../application/bot-routine.resolver';
import { AUTOMATION_WEBHOOK_REPOSITORY, WEBHOOK_SECRET_SEALER } from '../../automations.di-tokens';
import type {
  AutomationWebhookRepositoryPort,
  RoutineWebhookView,
} from '../../database/automation-webhook.repository.port';
import { AutomationErrors } from '../../domain/automations.errors';
import { issueSigningSecret, issueWebhookToken } from '../../domain/routine-webhook.policy';
import { IssueRoutineWebhookCommand } from './issue-routine-webhook.command';

export interface IssuedWebhook {
  view: RoutineWebhookView;
  /** Shown once: only its hash is kept. */
  token: string;
  /** Shown once, when asked for. */
  signingSecret: string | null;
}

/**
 * A routine's URL, new: the token and, when asked, the signing secret are
 * answered this once and never again, and the URL it had stops working at
 * once. Only a routine with a webhook trigger has one, so the bot that
 * writes triggers never holds a URL or a secret: the person issues them here.
 */
@CommandHandler(IssueRoutineWebhookCommand)
export class IssueRoutineWebhookCommandHandler
  implements ICommandHandler<IssueRoutineWebhookCommand, IssuedWebhook>
{
  constructor(
    private readonly routines: BotRoutineResolver,
    @Inject(AUTOMATION_WEBHOOK_REPOSITORY)
    private readonly webhooks: AutomationWebhookRepositoryPort,
    @Inject(WEBHOOK_SECRET_SEALER)
    private readonly sealer: KeySealer,
  ) {}

  async execute(command: IssueRoutineWebhookCommand): Promise<IssuedWebhook> {
    const routine = await this.routines.require(command.scope, command.botId, command.routineId);
    if (!routine.triggers.some((trigger) => trigger.source === 'webhook')) {
      throw new AppError(AutomationErrors.WEBHOOK_TRIGGER_MISSING);
    }
    if (command.signed && !this.sealer.isConfigured()) {
      throw new AppError(AutomationErrors.WEBHOOK_SIGNING_UNAVAILABLE);
    }
    const token = issueWebhookToken();
    const signingSecret = command.signed ? issueSigningSecret() : null;
    const view = await this.webhooks.issue({
      organizationId: routine.organizationId,
      automationId: routine.id,
      tokenHash: token.hash,
      tokenPrefix: token.prefix,
      signingSecretSealed: signingSecret ? this.sealer.seal(signingSecret) : null,
    });
    return { view, token: token.token, signingSecret };
  }
}
