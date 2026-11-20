import { Inject, Injectable } from '@nestjs/common';
import { BOT_CONVERSATION_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotConversationRepositoryPort } from '../database/bot-conversation.repository.port';
import type { BotTurnEntity } from '../domain/bot-turn.entity';

/**
 * Whether a turn still has somewhere to answer: the console chat always does; a
 * channel's conversation (Telegram, WhatsApp) only while its account is still
 * connected, since its answer is sent there. A turn with nowhere to answer ends
 * without running.
 */
@Injectable()
export class BotTurnChannelPolicy {
  constructor(
    @Inject(BOT_CONVERSATION_REPOSITORY)
    private readonly conversations: BotConversationRepositoryPort,
  ) {}

  /**
   * Who a contact's turn answers: a group (a WhatsApp group's id ends in
   * `@g.us`) or one person; null for a turn that is no contact's.
   */
  async contactChat(turn: BotTurnEntity): Promise<'direct' | 'group' | null> {
    if (!turn.contact) return null;
    const chat = await this.conversations.findChannelChat(turn.organizationId, turn.conversationId);
    return chat?.chatId.endsWith('@g.us') ? 'group' : 'direct';
  }

  async answerable(turn: BotTurnEntity): Promise<boolean> {
    if (turn.inConsole) return true;
    return (
      (await this.conversations.findChannelChat(turn.organizationId, turn.conversationId)) !== null
    );
  }
}
