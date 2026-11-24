import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  BotChannelReplyResolver,
  type ChannelReactOutcome,
} from '../../application/bot-channel-reply.resolver';
import { BOT_MESSAGE_REPOSITORY, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import type { BotMessageEntity } from '../../domain/bot-message.entity';
import { ReactAsBotCommand } from './react-as-bot.command';

/** What a bot's reaction came to: set or taken back on a message, or why not. */
export type ReactAsBotOutcome =
  | { kind: 'reacted'; messageId: string }
  | { kind: 'no_message' }
  | { kind: 'not_yours' }
  /** The channel the conversation is did not take it (`ChannelReactOutcome`). */
  | { kind: Exclude<ChannelReactOutcome, 'reacted'> };

/**
 * A bot reacts to a message of yours in the conversation its turn runs in:
 * the one it names, or the one that opened the turn. One reaction at a
 * time, beside yours; null takes it back. It wakes nothing. In a channel's
 * conversation (Slack, WhatsApp) it is the channel's own reaction, on the
 * message there, and is kept only once the channel took it, so the console
 * never shows one nobody saw.
 */
@CommandHandler(ReactAsBotCommand)
export class ReactAsBotCommandHandler
  implements ICommandHandler<ReactAsBotCommand, ReactAsBotOutcome>
{
  constructor(
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    private readonly channels: BotChannelReplyResolver,
  ) {}

  async execute(command: ReactAsBotCommand): Promise<ReactAsBotOutcome> {
    const { scope, organizationId, botId, conversationId, turnId, messageId, emoji } = command;
    const message = messageId
      ? await this.messages.findOne(scope, botId, messageId)
      : await this.messages.findOpening(organizationId, turnId);
    if (!message || message.conversationId !== conversationId) return { kind: 'no_message' };
    if (message.role !== 'user') return { kind: 'not_yours' };
    if (message.botReaction === emoji) return { kind: 'reacted', messageId: message.id };
    if (conversationId !== botId) {
      const sent = await this.onChannel(command, message);
      if (sent !== 'reacted') return { kind: sent };
    }
    message.reactAsBot(emoji);
    await this.messages.saveReaction(message);
    return { kind: 'reacted', messageId: message.id };
  }

  /**
   * The reaction on the channel's message: the one that opened the message's
   * turn, whose key the turn holds. A message folded into a turn another
   * opened has no key of its own, so the channel cannot be told which it is.
   */
  private async onChannel(
    command: ReactAsBotCommand,
    message: BotMessageEntity,
  ): Promise<ChannelReactOutcome> {
    const found = message.turnId
      ? await this.turns.findOne(command.scope, command.botId, message.turnId)
      : null;
    const turn = found?.isSome() ? found.unwrap() : null;
    const opening = turn ? await this.messages.findOpening(command.organizationId, turn.id) : null;
    const sourceKey = turn && opening?.id === message.id ? turn.sourceKey : null;
    return this.channels.react(
      {
        organizationId: command.organizationId,
        conversationId: command.conversationId,
        botId: command.botId,
        sourceKey,
      },
      command.emoji,
      message.botReaction,
    );
  }
}
