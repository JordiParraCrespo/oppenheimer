import type { WhatsappChatAnswer, WhatsappChatRouteEntity } from '@oppenheimer/frontend-consumer';
import type { ChatTab } from '@/features/whatsapp/lib/chats-search';

/** How many chats a page of a number's chats shows. */
export const CHATS_PAGE_SIZE = 25;

/** Who answers, as the filter names it: anyone or no one, the answered, no one, the default, or a bot's id. */
export type ChatsBy = 'all' | 'answered' | 'none' | 'default' | (string & {});

/** A chat's answer as the pickers' value: `none`, `default`, or a bot's id. */
export function answerValue(answer: WhatsappChatAnswer): string {
  return answer.kind === 'bot' ? answer.botId : answer.kind;
}

/** A pickers' value read back as an answer. */
export function answerOf(value: string): WhatsappChatAnswer {
  if (value === 'none' || value === 'default') return { kind: value };
  return { kind: 'bot', botId: value };
}

/**
 * One row of the list. A chat of the number, or the reader's own chat with it:
 * always a person, always answered by the number's default bot, and never
 * ticked or routed, since it is always theirs. Both carry what the filter
 * reads (the kind, who answers, the words a search matches), so the list is
 * narrowed and counted the same way whichever it is.
 */
export type ChatListRow =
  | {
      kind: 'chat';
      key: string;
      chatKind: 'direct' | 'group';
      answer: WhatsappChatAnswer;
      words: string;
      chat: WhatsappChatRouteEntity;
    }
  | {
      kind: 'owner';
      key: 'owner';
      chatKind: 'direct';
      answer: WhatsappChatAnswer;
      words: string;
      number: string;
    };

/** The reader's own number, as the list shows it; null before it is confirmed. */
export interface OwnerChat {
  /** `+digits`. */
  number: string;
  /** What the row is called ("You"), matched by the search as well as the number. */
  title: string;
}

/** Every row of the list, the reader's own first. */
function listRows(
  chats: readonly WhatsappChatRouteEntity[],
  owner: OwnerChat | null,
): ChatListRow[] {
  const rows: ChatListRow[] = chats.map((chat) => ({
    kind: 'chat',
    key: chat.chatId,
    chatKind: chat.chatKind,
    answer: chat.answer,
    words: `${chat.title} ${chat.phone ?? ''} ${chat.chatId}`.toLowerCase(),
    chat,
  }));
  if (!owner) return rows;
  return [
    {
      kind: 'owner',
      key: 'owner',
      chatKind: 'direct',
      answer: { kind: 'default' },
      words: `${owner.title} ${owner.number}`.toLowerCase(),
      number: owner.number,
    },
    ...rows,
  ];
}

/** Whether a row gets an answer at all: one of its own, or the default while the number has one. */
function answered(row: ChatListRow, defaultBotId: string | null): boolean {
  const { kind } = row.answer;
  return kind === 'bot' || (kind === 'default' && defaultBotId !== null);
}

function matchesBy(row: ChatListRow, by: ChatsBy, defaultBotId: string | null) {
  if (by === 'all') return true;
  if (by === 'answered') return answered(row, defaultBotId);
  return answerValue(row.answer) === by;
}

function matchesWords(row: ChatListRow, words: string): boolean {
  return !words || words.split(/\s+/).every((word) => row.words.includes(word));
}

/**
 * A number's chats as the page draws them: the tab's rows narrowed by the
 * words and by who answers, one page of them, and the counts the tabs and
 * the filter show (each counted with the other narrowings applied, so a
 * count says what picking it would leave).
 */
export function filterChats(
  chats: readonly WhatsappChatRouteEntity[],
  filter: { tab: ChatTab; query: string; by: ChatsBy; page: number },
  defaultBotId: string | null,
  owner: OwnerChat | null = null,
) {
  const words = filter.query.trim().toLowerCase();
  const all = listRows(chats, owner);
  const kindOf = (tab: ChatTab) => (tab === 'group' ? 'group' : 'direct');
  const worded = all.filter((row) => matchesWords(row, words));
  const inTab = worded.filter((row) => row.chatKind === kindOf(filter.tab));
  const shown = inTab.filter((row) => matchesBy(row, filter.by, defaultBotId));
  const pages = Math.max(1, Math.ceil(shown.length / CHATS_PAGE_SIZE));
  const page = Math.min(Math.max(1, filter.page), pages);
  return {
    rows: shown.slice((page - 1) * CHATS_PAGE_SIZE, page * CHATS_PAGE_SIZE),
    total: shown.length,
    page,
    pages,
    tabCounts: {
      group: worded.filter((row) => row.chatKind === 'group').length,
      person: worded.filter((row) => row.chatKind === 'direct').length,
    },
    byCount: (by: ChatsBy) => inTab.filter((row) => matchesBy(row, by, defaultBotId)).length,
    count: all.length,
    answeredCount: all.filter((row) => answered(row, defaultBotId)).length,
  };
}
