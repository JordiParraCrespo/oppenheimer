import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { botDefaultModel } from '@oppenheimer/shared';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import {
  BOT_LOOKUP,
  MODEL_PROVIDER_CREDENTIAL_REPOSITORY,
  PROVIDER_KEY_SEALER,
} from '../../../bots/bots.di-tokens';
import type { ModelProviderCredentialRepositoryPort } from '../../../bots/database/model-provider-credential.repository.port';
import { BotErrors } from '../../../bots/domain/bots.errors';
import type { ProviderKeySealerPort } from '../../../bots/infrastructure/provider-key-sealer.port';
import {
  BOT_APPROVAL_REPOSITORY,
  BOT_STREAM,
  BOT_TURN_REPOSITORY,
} from '../../bots-chat.di-tokens';
import type { BotApprovalRepositoryPort } from '../../database/bot-approval.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { BotMessageEntity } from '../../domain/bot-message.entity';
import { BotTurnEntity } from '../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { SendBotMessageCommand } from './send-bot-message.command';

/**
 * A message to a bot (`25-bots.md` §2): a queued turn on the bot's provider,
 * model and effort as they are now, with your message as its first. It runs
 * when the bot's turn before it ends. A provider with no key is refused here,
 * where the person can fix it, rather than failing in the worker. A card the
 * bot is waiting on expires: the person moved on.
 */
@CommandHandler(SendBotMessageCommand)
export class SendBotMessageCommandHandler
  implements ICommandHandler<SendBotMessageCommand, string>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly credentials: ModelProviderCredentialRepositoryPort,
    @Inject(PROVIDER_KEY_SEALER) private readonly sealer: ProviderKeySealerPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    @Inject(BOT_APPROVAL_REPOSITORY) private readonly approvals: BotApprovalRepositoryPort,
  ) {}

  async execute({
    scope,
    botId,
    content,
    timeZone,
    metadata,
  }: SendBotMessageCommand): Promise<string> {
    const bot = await this.lookup.bot(scope, botId);
    if (!this.sealer.isConfigured()) throw new AppError(BotErrors.PROVIDERS_NOT_CONFIGURED);
    if ((await this.credentials.findOne(scope, bot.provider)).isNone()) {
      throw new AppError(BotErrors.PROVIDER_KEY_MISSING, {
        detail: `The workspace has no ${bot.provider} key`,
        extensions: { provider: bot.provider },
      });
    }
    const turn = BotTurnEntity.queue({
      organizationId: bot.organizationId,
      botId: bot.id,
      requestedByUserId: scope.userId,
      provider: bot.provider,
      model: bot.model ?? botDefaultModel(bot.provider).id,
      effort: bot.effort,
      timeZone,
    });
    const message = BotMessageEntity.createNew({
      organizationId: bot.organizationId,
      botId: bot.id,
      turnId: turn.id,
      role: 'user',
      content,
      steps: [],
      position: 0,
    });
    const outcome = await this.turns.enqueue(turn, message, metadata.correlationId);
    if (outcome === 'missing') throw new AppError(BotErrors.NOT_FOUND);
    await this.stream.publish(bot.id, { type: 'turn', turnId: turn.id, status: 'queued' });
    await this.expireCard(bot.organizationId, bot.id);
    return turn.id;
  }

  /**
   * Writing to the bot instead of answering its card retires the card
   * (`25-bots.md` §5): the new turn starts fresh, and nobody decided. A
   * decision that lands first wins, and this does nothing.
   */
  private async expireCard(organizationId: string, botId: string): Promise<void> {
    const pending = await this.approvals.findPending(organizationId, botId);
    if (pending.isNone()) return;
    const approval = pending.unwrap();
    approval.expire(new Date());
    if (!(await this.approvals.saveTransition(approval))) return;
    await this.stream.publish(botId, {
      type: 'approval',
      approvalId: approval.id,
      status: 'expired',
    });
  }
}
