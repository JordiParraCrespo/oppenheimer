import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { botDefaultModel } from '@oppenheimer/shared';
import type { BotEntity } from '../../../bots/domain/bot.entity';
import { BotModelAccessResolver } from '../../application/bot-model-access.resolver';
import { BOT_MESSAGE_REPOSITORY, BOT_STREAM, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { BotMessageEntity } from '../../domain/bot-message.entity';
import { peerAnswerOf } from '../../domain/bot-peer-message.policy';
import { BotTurnEntity } from '../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { DeliverBotAnswerCommand } from './deliver-bot-answer.command';

/**
 * An ask's answer goes back (`25-bots.md` §4.6): when the asked turn ends,
 * its last text, or what happened to it, opens a queued turn of the bot that
 * asked, in its `bots` lane. The asker never holds a turn open waiting: it
 * ended its own, and picks the answer up as a new one. The answer is queued
 * once however often the job runs (`UQ_bot_turn_answers`). Nothing is owed
 * when the asker was deleted, its chat cleared, or the person's account is
 * gone.
 */
@CommandHandler(DeliverBotAnswerCommand)
export class DeliverBotAnswerCommandHandler
  implements ICommandHandler<DeliverBotAnswerCommand, void>
{
  private readonly logger = new Logger(DeliverBotAnswerCommandHandler.name);

  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    private readonly access: BotModelAccessResolver,
  ) {}

  async execute({ turnId, metadata }: DeliverBotAnswerCommand): Promise<void> {
    const found = await this.turns.findForRun(turnId);
    if (found.isNone()) return;
    const answered = found.unwrap();
    const { askedByBotId, askedByTurnId, organizationId } = answered;
    if (!answered.replyRequested || !answered.ended || !askedByBotId || !askedByTurnId) return;
    if (!answered.requestedByUserId) return;
    const [asker, answering] = await Promise.all([
      this.botOrNull(organizationId, askedByBotId),
      this.botOrNull(organizationId, answered.botId),
    ]);
    if (!asker || !answering) return;

    const answer = peerAnswerOf(
      answered,
      await this.messages.findTurnTexts(organizationId, answered.id),
    );
    const turn = BotTurnEntity.queueAnswer(answered, {
      botId: asker.id,
      provider: asker.provider,
      model: asker.model ?? botDefaultModel(asker.provider).id,
      effort: asker.effort,
    });
    const message = BotMessageEntity.createNew({
      organizationId,
      botId: asker.id,
      turnId: turn.id,
      role: 'event',
      content: answer.content,
      steps: [],
      position: 0,
      event: {
        kind: 'bot_reply',
        fromBotId: answering.id,
        fromBotName: answering.name,
        outcome: answer.outcome,
      },
    });
    const queued = await this.turns.enqueueAnswer(turn, message, metadata.correlationId);
    if (queued === 'duplicate' || queued === 'missing') return;
    await this.stream.publish(asker.id, { type: 'turn', turnId: turn.id, status: 'queued' });
  }

  /** The workspace's bot, or null once it is deleted. */
  private async botOrNull(organizationId: string, botId: string): Promise<BotEntity | null> {
    try {
      return await this.access.bot(organizationId, botId);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      this.logger.log({ message: 'An answer had no bot to go to', botId, code: error.code });
      return null;
    }
  }
}
