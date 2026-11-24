import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotModelAccessResolver } from '../../application/bot-model-access.resolver';
import { BotOwnerScopeResolver } from '../../application/bot-owner-scope.resolver';
import { BotTurnMapper } from '../../bot-turn.mapper';
import { BOT_STREAM, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { checkBackTurn } from '../../domain/bot-check-back.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { WakeOnCheckBackCommand } from './wake-on-check-back.command';

/**
 * A look a bot asked for with `check_back`, due now: the bot and its owner
 * resolved again, as for any wake, and the look's turn queued in the
 * background lane with the scopes and zone of the turn that set it, never
 * wider. The turn is keyed by the chain and the step, so a job delivered
 * twice queues one turn. A bot gone, with no owner, or whose owner left the
 * workspace, is woken for nothing: the chain ends there, since only a look's
 * own turn can go on with it.
 */
@CommandHandler(WakeOnCheckBackCommand)
export class WakeOnCheckBackCommandHandler
  implements ICommandHandler<WakeOnCheckBackCommand, void>
{
  private readonly logger = new Logger(WakeOnCheckBackCommandHandler.name);

  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    private readonly access: BotModelAccessResolver,
    private readonly owners: BotOwnerScopeResolver,
    private readonly mapper: BotTurnMapper,
  ) {}

  async execute({ look, metadata }: WakeOnCheckBackCommand): Promise<void> {
    const bot = await this.access.findBot(look.organizationId, look.botId);
    const ownerUserId = bot?.createdByUserId ?? null;
    const owner = bot ? await this.owners.resolve(look.organizationId, ownerUserId) : null;
    if (!bot || !ownerUserId || !owner) {
      this.logger.log({
        message: 'Check back skipped: the bot or its owner is gone',
        botId: look.botId,
        chainId: look.chainId,
        step: look.step,
      });
      return;
    }

    const { turn, opening } = checkBackTurn(
      this.mapper.toCheckBackTurnProps(look, bot, ownerUserId),
      look,
    );
    const queued = await this.turns.enqueueOnce(turn, opening, metadata.correlationId, null);
    if (queued.outcome === 'staged' || queued.outcome === 'waiting') {
      await this.stream.publish(bot.id, { type: 'turn', turnId: queued.turnId, status: 'queued' });
    }
  }
}
