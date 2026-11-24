import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotRoutineResolver } from '../../application/bot-routine.resolver';
import { AUTOMATION_WEBHOOK_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationWebhookRepositoryPort } from '../../database/automation-webhook.repository.port';
import { RevokeRoutineWebhookCommand } from './revoke-routine-webhook.command';

/**
 * A routine's URL, gone. Its webhook trigger stays: the routine runs on
 * nothing posted until a new URL is issued. Idempotent.
 */
@CommandHandler(RevokeRoutineWebhookCommand)
export class RevokeRoutineWebhookCommandHandler
  implements ICommandHandler<RevokeRoutineWebhookCommand, void>
{
  constructor(
    private readonly routines: BotRoutineResolver,
    @Inject(AUTOMATION_WEBHOOK_REPOSITORY)
    private readonly webhooks: AutomationWebhookRepositoryPort,
  ) {}

  async execute(command: RevokeRoutineWebhookCommand): Promise<void> {
    const routine = await this.routines.require(command.scope, command.botId, command.routineId);
    await this.webhooks.revoke(routine.organizationId, routine.id);
  }
}
