import { WHATSAPP_CHAT_GRANTS_MAX, type WhatsappChatRoute } from '@oppenheimer/shared';
import { WhatsappChatGrantEntity } from './whatsapp-chat-grant.entity';
import type { WhatsappChat, WhatsappKnownChat } from './whatsapp-message.types';
import { sameWhatsappNumber } from './whatsapp-number.policy';

/** One chat of a number as Settings lists it: what the number saw of it, and who answers it. */
export interface WhatsappChatRouteRow {
  chatId: string;
  chatKind: 'direct' | 'group';
  chatName: string | null;
  messageCount: number;
  /** When the number last saw a message in it; null for a chat allowed before any message. */
  lastAt: Date | null;
  /** The chat's grant: allowed, with its bot (null: the number's default); null when not answered. */
  grant: WhatsappChatGrantEntity | null;
}

/** What the number knows of its owner, to keep the owner's own chat and its own out. */
export interface WhatsappRouteAccount {
  organizationId: string;
  id: string;
  phone: string | null;
  isOwner(chatId: string): boolean;
}

/**
 * The chats Settings lists for a number: every chat it saw (newest first),
 * then those its device reports it can be reached in with no message kept
 * (its groups, then its contacts, as reported), then any it allows that is
 * neither, each with its grant. A chat seen with no name of its own takes
 * the one its device reports. The owner's
 * own chat and the number's chat with itself are not chats to route: the
 * first is always the owner's, the second nobody's.
 */
export function whatsappChatRoutes(
  account: WhatsappRouteAccount,
  seen: readonly WhatsappChat[],
  grants: readonly WhatsappChatGrantEntity[],
  known: readonly WhatsappKnownChat[] = [],
): WhatsappChatRouteRow[] {
  const grantOf = new Map(grants.map((grant) => [grant.chatId, grant]));
  const knownName = new Map(known.map((chat) => [chat.chatId, chat.chatName]));
  const rows: WhatsappChatRouteRow[] = seen.map((chat) => ({
    chatId: chat.chatId,
    chatKind: chat.chatKind,
    chatName: chat.chatName ?? knownName.get(chat.chatId) ?? null,
    messageCount: chat.messageCount,
    lastAt: chat.last.sentAt,
    grant: grantOf.get(chat.chatId) ?? null,
  }));
  const listed = new Set(rows.map((row) => row.chatId));
  const reported = [
    ...known.filter((chat) => chat.chatKind === 'group'),
    ...known.filter((chat) => chat.chatKind === 'direct'),
  ];
  for (const chat of reported) {
    if (listed.has(chat.chatId)) continue;
    listed.add(chat.chatId);
    const grant = grantOf.get(chat.chatId) ?? null;
    rows.push({
      chatId: chat.chatId,
      chatKind: chat.chatKind,
      chatName: chat.chatName ?? grant?.chatName ?? null,
      messageCount: 0,
      lastAt: null,
      grant,
    });
  }
  for (const grant of grants) {
    if (listed.has(grant.chatId)) continue;
    rows.push({
      chatId: grant.chatId,
      chatKind: grant.chatKind,
      chatName: grant.chatName,
      messageCount: 0,
      lastAt: null,
      grant,
    });
  }
  return rows.filter((row) => routable(account, row.chatId, row.chatKind));
}

/**
 * What of a device's report a number keeps: each chat once, never the
 * owner's own chat or the number's chat with itself (they are not chats to
 * route), with no name as null.
 */
export function whatsappKnownChats(
  account: WhatsappRouteAccount,
  reported: readonly { chatId: string; chatKind: 'direct' | 'group'; chatName?: string }[],
): WhatsappKnownChat[] {
  const byId = new Map<string, WhatsappKnownChat>();
  for (const chat of reported) {
    if (!routable(account, chat.chatId, chat.chatKind)) continue;
    byId.set(chat.chatId, {
      chatId: chat.chatId,
      chatKind: chat.chatKind,
      chatName: chat.chatName ?? null,
    });
  }
  return [...byId.values()];
}

/** What one change of who answers a set of chats writes. */
export interface WhatsappRouteChanges {
  insert: WhatsappChatGrantEntity[];
  save: WhatsappChatGrantEntity[];
  delete: WhatsappChatGrantEntity[];
}

/** Why a change of who answers was refused, for the handler to say. */
export type WhatsappRouteRefusal =
  | { kind: 'unknown'; chatId: string }
  | { kind: 'not_routable'; chatId: string }
  | { kind: 'limit' };

/**
 * Who answers `chatIds` from now on, as grants to write: `none` removes each
 * chat's grant (its messages are only kept); `default` and `bot` allow each
 * chat not allowed yet and set every one's bot (null: the number's default).
 * Only chats Settings lists may be named; the number never allows more than
 * `WHATSAPP_CHAT_GRANTS_MAX` chats. A chat already as asked writes nothing.
 */
export function whatsappRouteChanges(
  account: WhatsappRouteAccount,
  rows: readonly WhatsappChatRouteRow[],
  chatIds: readonly string[],
  route: WhatsappChatRoute,
  botId: string | null,
): WhatsappRouteChanges | WhatsappRouteRefusal {
  const rowOf = new Map(rows.map((row) => [row.chatId, row]));
  const changes: WhatsappRouteChanges = { insert: [], save: [], delete: [] };
  for (const chatId of new Set(chatIds)) {
    const row = rowOf.get(chatId);
    if (!row) {
      return routable(account, chatId, 'direct')
        ? { kind: 'unknown', chatId }
        : { kind: 'not_routable', chatId };
    }
    const grant = row.grant;
    if (route === 'none') {
      if (grant) changes.delete.push(grant);
      continue;
    }
    const answeredBy = route === 'bot' ? botId : null;
    if (grant) {
      if (grant.botId === answeredBy) continue;
      grant.answerAs(answeredBy);
      changes.save.push(grant);
      continue;
    }
    changes.insert.push(
      WhatsappChatGrantEntity.allow({
        organizationId: account.organizationId,
        accountId: account.id,
        chatId: row.chatId,
        chatKind: row.chatKind,
        chatName: row.chatName,
        botId: answeredBy,
        grantedByBotId: null,
      }),
    );
  }
  const allowed = rows.filter((row) => row.grant).length - changes.delete.length;
  if (allowed + changes.insert.length > WHATSAPP_CHAT_GRANTS_MAX) return { kind: 'limit' };
  return changes;
}

function routable(account: WhatsappRouteAccount, chatId: string, kind: 'direct' | 'group') {
  if (kind === 'group') return true;
  if (account.isOwner(chatId)) return false;
  return account.phone === null || !sameWhatsappNumber(account.phone, chatId);
}
