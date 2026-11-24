import { Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { MarkSlackWorkingCommand } from '../../slack/commands/mark-slack-working/mark-slack-working.command';
import { ReplyOnSlackCommand } from '../../slack/commands/reply-on-slack/reply-on-slack.command';
import { ReplyOnTelegramCommand } from '../../telegram/commands/reply-on-telegram/reply-on-telegram.command';
import { ReplyOnWhatsappCommand } from '../../whatsapp/commands/reply-on-whatsapp/reply-on-whatsapp.command';
import { BOT_CONVERSATION_REPOSITORY } from '../bots-chat.di-tokens';
import type {
  BotChannelChat,
  BotConversationRepositoryPort,
} from '../database/bot-conversation.repository.port';
import { slackTsOf } from '../domain/bot-slack-turn.policy';
import { telegramMessageIdOf } from '../domain/bot-telegram-turn.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import { whatsappMessageRowIdOf } from '../domain/bot-whatsapp-turn.policy';

/** What every channel's reply carries; the channel adds its chat and what it quotes. */
type ChannelReply = Omit<
  ConstructorParameters<typeof ReplyOnTelegramCommand>[0],
  'accountId' | 'replyToId'
>;

/** What of a turn its chat is found by. */
type ChannelTurn = Pick<BotTurnEntity, 'organizationId' | 'conversationId' | 'botId' | 'sourceKey'>;

type ChannelReplyCommand = ReplyOnTelegramCommand | ReplyOnWhatsappCommand | ReplyOnSlackCommand;

/** A voice note the reply is spoken as; only WhatsApp sends one (`sendVoice`). */
type ChannelVoice = { audio: Buffer; seconds: number };

/** The reply for a chat's channel, quoting the message the turn's key names. */
function replyOn(
  chat: BotChannelChat,
  sourceKey: string | null,
  reply: ChannelReply,
): ChannelReplyCommand {
  switch (chat.kind) {
    case 'telegram':
      return new ReplyOnTelegramCommand({
        ...reply,
        accountId: chat.telegramAccountId,
        replyToId: telegramMessageIdOf(sourceKey),
      });
    case 'whatsapp':
      return new ReplyOnWhatsappCommand({
        ...reply,
        accountId: chat.whatsappAccountId,
        replyToRowId: whatsappMessageRowIdOf(sourceKey),
      });
    // A Slack chat is the thread itself, so the answer needs nothing to quote.
    case 'slack':
      return new ReplyOnSlackCommand({ ...reply, accountId: chat.slackAccountId });
  }
}

/**
 * Sends a channel turn's words to the chat its conversation is, as a reply to
 * the message that opened the turn, through the module of the chat's channel
 * (telegram, whatsapp, slack), which sends only while this bot still answers that
 * chat. Answers how many messages went: none for a conversation that is no
 * channel's chat (any more), a chat this bot no longer answers, or a host
 * that did not send. `sendVoice` is the one other kind of reply: a WhatsApp
 * chat hears the words as one voice note. What the turn's end owes and what it sends as it goes
 * are the callers'. A turn's start and end are shown on the chat where its
 * channel has a way to (`started`, `ended`).
 */
@Injectable()
export class BotChannelReplyResolver {
  constructor(
    @Inject(BOT_CONVERSATION_REPOSITORY)
    private readonly conversations: BotConversationRepositoryPort,
    private readonly commands: CommandBus,
  ) {}

  async send(turn: ChannelTurn, text: string, correlationId: string | undefined): Promise<number> {
    const chat = await this.conversations.findChannelChat(turn.organizationId, turn.conversationId);
    if (!chat) return 0;
    return this.commands.execute<ChannelReplyCommand, number>(
      replyOn(chat, turn.sourceKey, this.replyOf(turn, chat, text, correlationId)),
    );
  }

  /**
   * Sends the words as one voice note saying them. Only a WhatsApp chat can
   * hear one, so any other chat, or none, answers 0 and the caller sends
   * the words instead.
   */
  async sendVoice(
    turn: ChannelTurn,
    text: string,
    correlationId: string | undefined,
    voice: ChannelVoice,
  ): Promise<number> {
    const chat = await this.conversations.findChannelChat(turn.organizationId, turn.conversationId);
    if (chat?.kind !== 'whatsapp') return 0;
    return this.commands.execute<ReplyOnWhatsappCommand, number>(
      new ReplyOnWhatsappCommand({
        ...this.replyOf(turn, chat, text, correlationId),
        accountId: chat.whatsappAccountId,
        replyToRowId: whatsappMessageRowIdOf(turn.sourceKey),
        voice,
      }),
    );
  }

  private replyOf(
    turn: ChannelTurn,
    chat: BotChannelChat,
    text: string,
    correlationId: string | undefined,
  ): ChannelReply {
    return {
      organizationId: turn.organizationId,
      chatId: chat.chatId,
      text,
      botId: turn.botId,
      metadata: { correlationId },
    };
  }

  /** The turn's run started: the chat shows it is being worked on, where its channel can. */
  started(turn: ChannelTurn): Promise<void> {
    return this.markWorking(turn, true);
  }

  /** The turn ended (its answer sent or not): the chat stops showing it is being worked on. */
  ended(turn: ChannelTurn): Promise<void> {
    return this.markWorking(turn, false);
  }

  /**
   * The one channel with a working sign is Slack, the reaction on the
   * message the turn is on (`MarkSlackWorkingCommand`); every other channel,
   * and a turn that is no channel's, shows nothing.
   */
  private async markWorking(turn: ChannelTurn, working: boolean): Promise<void> {
    const ts = slackTsOf(turn.sourceKey);
    if (!ts) return;
    const chat = await this.conversations.findChannelChat(turn.organizationId, turn.conversationId);
    if (chat?.kind !== 'slack') return;
    await this.commands.execute(
      new MarkSlackWorkingCommand({
        organizationId: turn.organizationId,
        accountId: chat.slackAccountId,
        chatId: chat.chatId,
        ts,
        botId: turn.botId,
        working,
      }),
    );
  }
}
