import type { TelegramAccountEntity } from '../telegram/domain/telegram-account.entity';
import type {
  TelegramChat,
  TelegramChatTarget,
  TelegramMessage,
} from '../telegram/domain/telegram-message.types';
import { promptText } from './domain/bot-prompt-text.policy';
import { cut, fenceUntrusted, formatToolTime } from './domain/bot-tool-text.policy';

/**
 * How a bot's Telegram tools write a
 * Telegram bot's chats for the model: one line per chat or message with its
 * ids inline, and everything another person can write (names, usernames,
 * texts) inside `<telegram>`, marked as data.
 */

export const NO_TELEGRAM = promptText('telegram/tools.no-telegram');

export const TELEGRAM_UNTRUSTED_NOTE = promptText('telegram/tools.telegram-untrusted-note');

const SNIPPET_MAX = 160;

export function fenceTelegram(text: string): string {
  return fenceUntrusted('telegram', text);
}

/** One Telegram bot, as `list_telegram_accounts` and every answer's header name it. */
export function describeTelegramAccount(
  account: TelegramAccountEntity,
  hostOnline: boolean,
): string {
  const handle = account.username ? `@${account.username}` : 'not checked yet';
  const state = !hostOnline
    ? promptText('telegram/tools.account-host-offline')
    : account.isConnected
      ? 'connected'
      : account.status === 'connecting'
        ? 'connecting'
        : promptText('telegram/tools.account-needs-reconnect', {
            status: account.status,
          });
  return `"${account.label}" ${handle} (account id ${account.id}, ${state})`;
}

/** Who wrote a message, as the model reads it. */
function senderOf(message: TelegramMessage): string {
  if (message.sentByBotId) return promptText('telegram/tools.sender-of');
  if (message.fromBot) return 'the Telegram bot';
  const handle = message.senderUsername ? `@${message.senderUsername}` : null;
  return [message.senderName, handle].filter(Boolean).join(' ') || `user ${message.senderId}`;
}

/** One message on one line: when, who, what. */
export function describeTelegramMessage(message: TelegramMessage, timeZone: string): string {
  const media = message.media ? `[${message.media}] ` : '';
  const reply = message.replyToId ? ` (replying to ${message.replyToId})` : '';
  return `${formatToolTime(message.sentAt, timeZone)} · ${senderOf(message)}${reply} · id ${message.externalId}: ${media}${message.text || '(no text)'}`;
}

/** A chat in a list: its id, its name, its last message cut short. */
export function describeTelegramChat(chat: TelegramChat, timeZone: string): string {
  const name = chat.chatName ?? chat.chatId;
  const last = { ...chat.last, text: cut(chat.last.text, SNIPPET_MAX) };
  return promptText('telegram/tools.describe-telegram-chat', {
    chatKind: chat.chatKind === 'group' ? 'group' : 'chat',
    name,
    chatId: chat.chatId,
    messageCount: String(chat.messageCount),
    describeTelegramMessage: describeTelegramMessage(last, timeZone),
  });
}

/** Where a send goes, as the card and the answer name it. */
export function describeTelegramTarget(chat: TelegramChatTarget): string {
  const name = chat.chatName ?? chat.chatId;
  return chat.chatKind === 'group' ? `the group "${name}"` : name;
}

/**
 * The send a card stores and a call runs: which Telegram bot, and which of
 * its chats, as the server resolved them. Never what was said in the chat.
 */
export function plannedTelegramSend(
  account: Pick<TelegramAccountEntity, 'id' | 'label'>,
  chat: TelegramChatTarget,
): {
  accountId: string;
  accountLabel: string;
  chatId: string;
  chatKind: 'direct' | 'group';
  chatName: string | null;
} {
  return {
    accountId: account.id,
    accountLabel: account.label,
    chatId: chat.chatId,
    chatKind: chat.chatKind,
    chatName: chat.chatName,
  };
}
