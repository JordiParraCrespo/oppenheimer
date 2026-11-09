import { Inject, Injectable } from '@nestjs/common';
import { botDefaultModel } from '@oppenheimer/shared';
import { BOT_CONVERSATION_REPOSITORY, BOT_TURN_REPOSITORY } from '../bots-chat.di-tokens';
import type {
  BotChannelChat,
  BotConversationRepositoryPort,
} from '../database/bot-conversation.repository.port';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';
import type { ChannelTurnProps } from '../domain/bot-channel-turn.policy';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import { BotModelAccessResolver } from './bot-model-access.resolver';

/** One message of the owner's on a channel, for the bot that answers the chat. */
export interface BotChannelWake {
  chat: BotChannelChat;
  /** The chat's last start at or before the message, '0' for none, fixed when it was stored. */
  startsAt: string;
  /** The message's place in the chat's order (Telegram's id, `whatsapp_message.seq`). */
  messageId: string;
  command: 'message' | 'new' | 'stop';
  /** The owner who wrote it: only a bot they made answers them. */
  userId: string;
  /** The turn the message queues, and its opening, in the conversation that holds it. */
  turn: (
    props: ChannelTurnProps,
    conversationId: string,
  ) => { turn: BotTurnEntity; opening: BotMessageEntity };
  correlationId: string | null;
}

/**
 * What the owner's message on a channel does to the chat's conversation with
 * its bot (`product/next-steps/answering-on-telegram-and-whatsapp.md`), the
 * same on every channel: it lands in the conversation that holds it (made
 * now when it starts there); `/new` is only that start; `/stop` asks the
 * conversation's running turn to stop; anything else is a turn, keyed by the
 * message so a delivery twice is one turn. A bot that is gone, or that the
 * owner did not make, is woken by nothing, so a channel never reaches someone
 * else's bot. The chat, and the turn's key and words, are the channel's.
 */
@Injectable()
export class BotChannelWakeResolver {
  constructor(
    @Inject(BOT_CONVERSATION_REPOSITORY)
    private readonly conversations: BotConversationRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    private readonly access: BotModelAccessResolver,
  ) {}

  async wake(wake: BotChannelWake): Promise<void> {
    const { organizationId, botId } = wake.chat;
    const bot = await this.access.findBot(organizationId, botId);
    if (!bot || bot.createdByUserId !== wake.userId) return;
    const conversationId = await this.conversations.conversationAt(
      wake.chat,
      wake.startsAt,
      wake.messageId,
    );
    // `/new` is the start of its own conversation, made above.
    if (wake.command === 'new') return;
    if (wake.command === 'stop') {
      const running = await this.turns.findRunningIn(wake.chat.organizationId, conversationId);
      if (running) await this.turns.requestCancel(running, new Date());
      return;
    }
    const props: ChannelTurnProps = {
      organizationId,
      botId: bot.id,
      requestedByUserId: wake.userId,
      provider: bot.provider,
      model: bot.model ?? botDefaultModel(bot.provider).id,
      effort: bot.effort,
    };
    const { turn, opening } = wake.turn(props, conversationId);
    // Not on the bot's stream, which is its console chat's.
    await this.turns.enqueueOnce(turn, opening, wake.correlationId, null);
  }
}
