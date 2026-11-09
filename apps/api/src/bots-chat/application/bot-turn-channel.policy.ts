import { Inject, Injectable } from '@nestjs/common';
import { BOT_CONVERSATION_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotConversationRepositoryPort } from '../database/bot-conversation.repository.port';
import type { BotTurnEntity } from '../domain/bot-turn.entity';

/**
 * Whether a turn still has somewhere to answer
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md`): the console
 * chat always does; a Telegram turn only while its chat's Telegram bot is
 * still connected, since its answer is sent there. A turn with nowhere to
 * answer ends without running. The next channel answers here, once.
 */
@Injectable()
export class BotTurnChannelPolicy {
  constructor(
    @Inject(BOT_CONVERSATION_REPOSITORY)
    private readonly conversations: BotConversationRepositoryPort,
  ) {}

  async answerable(turn: BotTurnEntity): Promise<boolean> {
    if (turn.origin !== 'telegram') return true;
    return (
      (await this.conversations.findTelegram(turn.organizationId, turn.conversationId)) !== null
    );
  }
}
