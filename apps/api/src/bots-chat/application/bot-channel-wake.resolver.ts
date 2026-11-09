import { Inject, Injectable } from '@nestjs/common';
import { BOT_CONVERSATION_REPOSITORY, BOT_TURN_REPOSITORY } from '../bots-chat.di-tokens';
import type {
  BotChannelChat,
  BotConversationRepositoryPort,
} from '../database/bot-conversation.repository.port';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';

/** One message of the owner's on a channel, for the bot that answers the chat. */
export interface BotChannelWake {
  chat: BotChannelChat;
  /** The chat's last start at or before the message, '0' for none, fixed when it was stored. */
  startsAt: string;
  /** The message's place in the chat's order (Telegram's id, `whatsapp_message.seq`). */
  messageId: string;
  command: 'message' | 'new' | 'stop';
  /** The turn the message queues, and its opening, in the conversation that holds it. */
  turn: (conversationId: string) => { turn: BotTurnEntity; opening: BotMessageEntity };
  correlationId: string | null;
}

/**
 * What the owner's message on a channel does to the chat's conversation with
 * its bot (`product/next-steps/answering-on-telegram-and-whatsapp.md`), the
 * same on every channel: it lands in the conversation that holds it (made
 * now when it starts there); `/new` is only that start; `/stop` asks the
 * conversation's running turn to stop; anything else is a turn, keyed by the
 * message so a delivery twice is one turn. Whose bot it is, and the turn's
 * key and words, are the channel's.
 */
@Injectable()
export class BotChannelWakeResolver {
  constructor(
    @Inject(BOT_CONVERSATION_REPOSITORY)
    private readonly conversations: BotConversationRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
  ) {}

  async wake(wake: BotChannelWake): Promise<void> {
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
    const { turn, opening } = wake.turn(conversationId);
    // Not on the bot's stream, which is its console chat's.
    await this.turns.enqueueOnce(turn, opening, wake.correlationId, null);
  }
}
