import type { WhatsappAccountEntity } from '../whatsapp/domain/whatsapp-account.entity';
import type { WhatsappChatGrantEntity } from '../whatsapp/domain/whatsapp-chat-grant.entity';
import type {
  WhatsappChat,
  WhatsappChatTarget,
  WhatsappMessage,
} from '../whatsapp/domain/whatsapp-message.types';
import { promptText } from './domain/bot-prompt-text.policy';
import { cut, fenceUntrusted, formatToolTime } from './domain/bot-tool-text.policy';

/**
 * How a bot's WhatsApp tools write a
 * number's chats for the model: one line per chat or message with its ids
 * inline, and everything another person can write (names, texts) inside
 * `<whatsapp>`, marked as data.
 */

export const NO_WHATSAPP = promptText('tools/whatsapp.no-whatsapp');

export const WHATSAPP_UNTRUSTED_NOTE = promptText('tools/whatsapp.whatsapp-untrusted-note');

const SNIPPET_MAX = 160;

export function fenceWhatsapp(text: string): string {
  return fenceUntrusted('whatsapp', text);
}

/** `34600111222@s.whatsapp.net` → `+34600111222`; a group's id is left as it is. */
export function phoneOf(jid: string | null): string | null {
  if (!jid) return null;
  const [user, server] = jid.split('@');
  return server === 's.whatsapp.net' && user ? `+${user.split(':')[0]}` : null;
}

/** One number, as `list_whatsapp_accounts` and every answer's header name it. */
export function describeWhatsappAccount(
  account: WhatsappAccountEntity,
  hostOnline: boolean,
): string {
  const number = phoneOf(account.phone) ?? 'not paired yet';
  const state = !hostOnline
    ? promptText('tools/whatsapp.account-host-offline')
    : account.isConnected
      ? 'connected'
      : promptText('tools/whatsapp.account-needs-pairing', {
          replace: account.status.replace('_', ' '),
        });
  return `"${account.label}" ${number} (account id ${account.id}, ${state})`;
}

/** Who wrote a message, as the model reads it. */
function senderOf(message: WhatsappMessage): string {
  if (message.sentByBotId) return 'a bot, as the owner';
  if (message.fromMe) return 'the owner';
  const phone = phoneOf(message.senderId);
  return [message.senderName, phone].filter(Boolean).join(' ') || message.senderId;
}

/** One message on one line: when, who, what. */
export function describeWhatsappMessage(message: WhatsappMessage, timeZone: string): string {
  const media = message.media ? `[${message.media}] ` : '';
  const quoted = message.quotedId ? ` (replying to ${message.quotedId})` : '';
  return `${formatToolTime(message.sentAt, timeZone)} · ${senderOf(message)}${quoted} · id ${message.externalId}: ${media}${message.text || '(no text)'}`;
}

/** A chat in a list: its id, its name, its last message cut short. */
export function describeWhatsappChat(chat: WhatsappChat, timeZone: string): string {
  const name = chat.chatName ?? phoneOf(chat.chatId) ?? chat.chatId;
  const last = { ...chat.last, text: cut(chat.last.text, SNIPPET_MAX) };
  return promptText('tools/whatsapp.describe-whatsapp-chat', {
    chatKind: chat.chatKind === 'group' ? 'group' : 'chat',
    name,
    chatId: chat.chatId,
    messageCount: String(chat.messageCount),
    describeWhatsappMessage: describeWhatsappMessage(last, timeZone),
  });
}

/** Where a send goes, as the card and the answer name it. */
export function describeWhatsappTarget(chat: WhatsappChatTarget): string {
  const name = chat.chatName ?? phoneOf(chat.chatId) ?? chat.chatId;
  if (chat.isNew) return `a new chat with ${name}`;
  return chat.chatKind === 'group' ? `the group "${name}"` : `${name}`;
}

/** An allowed chat as a chat the number has, for the lines that name it. */
export function whatsappTargetOfGrant(
  grant: Pick<WhatsappChatGrantEntity, 'chatId' | 'chatKind' | 'chatName'>,
): WhatsappChatTarget {
  return { chatId: grant.chatId, chatKind: grant.chatKind, chatName: grant.chatName, isNew: false };
}

/** One allowed chat, as the tools list it: who, which bot answers, and which bot allowed it. */
export function describeWhatsappGrant(
  grant: Pick<
    WhatsappChatGrantEntity,
    'chatId' | 'chatKind' | 'chatName' | 'botId' | 'grantedByBotId'
  >,
  botNames: ReadonlyMap<string, string>,
): string {
  const who = describeWhatsappTarget(whatsappTargetOfGrant(grant));
  const answers = grant.botId
    ? `${botNames.get(grant.botId) ?? 'a bot of theirs'} answers`
    : promptText('tools/whatsapp.grant-default-bot-answers');
  const allowedBy = grant.grantedByBotId
    ? `allowed by ${botNames.get(grant.grantedByBotId) ?? 'a bot'}`
    : 'allowed in Settings';
  return `${who} (chat id ${grant.chatId}): ${answers}; ${allowedBy}`;
}
