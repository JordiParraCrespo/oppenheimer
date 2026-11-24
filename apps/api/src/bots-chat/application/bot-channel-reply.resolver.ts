import { Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { MarkSlackWorkingCommand } from '../../slack/commands/mark-slack-working/mark-slack-working.command';
import {
  ReactOnSlackCommand,
  type SlackReactOutcome,
} from '../../slack/commands/react-on-slack/react-on-slack.command';
import { ReplyOnSlackCommand } from '../../slack/commands/reply-on-slack/reply-on-slack.command';
import { ReplyOnTelegramCommand } from '../../telegram/commands/reply-on-telegram/reply-on-telegram.command';
import { ReactOnWhatsappCommand } from '../../whatsapp/commands/react-on-whatsapp/react-on-whatsapp.command';
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

/**
 * What a bot's reaction on a conversation's channel came to: `reacted`;
 * `no_channel` for a conversation that is no channel's chat (any more);
 * `unreachable` for a message the channel has no key for (folded into a
 * turn another message opened); `no_name` for an emoji Slack has no name for
 * here, `working_sign` for 👀, Slack's working sign; `unsupported` on a
 * channel without reactions (Telegram); `not_sent` when the channel did not
 * take it (the bot no longer answers there, the host offline or too old).
 */
export type ChannelReactOutcome =
  | 'reacted'
  | 'no_channel'
  | 'unreachable'
  | 'no_name'
  | 'working_sign'
  | 'unsupported'
  | 'not_sent';

/** What of a turn its chat is found by. */
type ChannelTurn = Pick<BotTurnEntity, 'organizationId' | 'conversationId' | 'botId' | 'sourceKey'>;

type ChannelReplyCommand = ReplyOnTelegramCommand | ReplyOnWhatsappCommand | ReplyOnSlackCommand;

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
 * that did not send. What the turn's end owes and what it sends as it goes
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
    const reply: ChannelReply = {
      organizationId: turn.organizationId,
      chatId: chat.chatId,
      text,
      botId: turn.botId,
      metadata: { correlationId },
    };
    return this.commands.execute<ChannelReplyCommand, number>(replyOn(chat, turn.sourceKey, reply));
  }

  /**
   * Puts the bot's reaction on the channel's message a turn opened on (its
   * `sourceKey`), as the channel's own reaction, in place of `previous`;
   * null `emoji` takes it back. On WhatsApp it reacts as the number, as the
   * bot's reply there is sent as the number.
   */
  async react(
    turn: ChannelTurn,
    emoji: string | null,
    previous: string | null,
  ): Promise<ChannelReactOutcome> {
    const chat = await this.conversations.findChannelChat(turn.organizationId, turn.conversationId);
    if (!chat) return 'no_channel';
    switch (chat.kind) {
      case 'telegram':
        return 'unsupported';
      case 'whatsapp': {
        const rowId = whatsappMessageRowIdOf(turn.sourceKey);
        if (!rowId) return 'unreachable';
        const sent = await this.commands.execute<ReactOnWhatsappCommand, boolean>(
          new ReactOnWhatsappCommand({
            organizationId: turn.organizationId,
            accountId: chat.whatsappAccountId,
            chatId: chat.chatId,
            messageRowId: rowId,
            emoji: emoji ?? '',
            botId: turn.botId,
          }),
        );
        return sent ? 'reacted' : 'not_sent';
      }
      case 'slack': {
        const ts = slackTsOf(turn.sourceKey);
        if (!ts) return 'unreachable';
        return this.commands.execute<ReactOnSlackCommand, SlackReactOutcome>(
          new ReactOnSlackCommand({
            organizationId: turn.organizationId,
            accountId: chat.slackAccountId,
            chatId: chat.chatId,
            ts,
            botId: turn.botId,
            emoji,
            previous,
          }),
        );
      }
    }
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
