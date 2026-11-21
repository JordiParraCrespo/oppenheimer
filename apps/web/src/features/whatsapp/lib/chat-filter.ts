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

/** Whether a chat gets an answer at all: one of its own, or the default while the number has one. */
function answered(chat: WhatsappChatRouteEntity, defaultBotId: string | null): boolean {
  const { kind } = chat.answer;
  return kind === 'bot' || (kind === 'default' && defaultBotId !== null);
}

function matchesBy(chat: WhatsappChatRouteEntity, by: ChatsBy, defaultBotId: string | null) {
  if (by === 'all') return true;
  if (by === 'answered') return answered(chat, defaultBotId);
  return answerValue(chat.answer) === by;
}

function matchesWords(chat: WhatsappChatRouteEntity, words: string): boolean {
  if (!words) return true;
  const haystack = `${chat.title} ${chat.phone ?? ''} ${chat.chatId}`.toLowerCase();
  return words.split(/\s+/).every((word) => haystack.includes(word));
}

/**
 * A number's chats as the page draws them: the tab's chats narrowed by the
 * words and by who answers, one page of them, and the counts the tabs and
 * the filter show (each counted with the other narrowings applied, so a
 * count says what picking it would leave).
 */
export function filterChats(
  chats: readonly WhatsappChatRouteEntity[],
  filter: { tab: ChatTab; query: string; by: ChatsBy; page: number },
  defaultBotId: string | null,
) {
  const words = filter.query.trim().toLowerCase();
  const kindOf = (tab: ChatTab) => (tab === 'group' ? 'group' : 'direct');
  const worded = chats.filter((chat) => matchesWords(chat, words));
  const inTab = worded.filter((chat) => chat.chatKind === kindOf(filter.tab));
  const shown = inTab.filter((chat) => matchesBy(chat, filter.by, defaultBotId));
  const pages = Math.max(1, Math.ceil(shown.length / CHATS_PAGE_SIZE));
  const page = Math.min(Math.max(1, filter.page), pages);
  const byCounts = new Map<string, number>();
  for (const chat of inTab) {
    const value = answerValue(chat.answer);
    byCounts.set(value, (byCounts.get(value) ?? 0) + 1);
  }
  return {
    rows: shown.slice((page - 1) * CHATS_PAGE_SIZE, page * CHATS_PAGE_SIZE),
    total: shown.length,
    page,
    pages,
    tabCounts: {
      group: worded.filter((chat) => chat.chatKind === 'group').length,
      person: worded.filter((chat) => chat.chatKind === 'direct').length,
    },
    byCount: (by: ChatsBy) =>
      by === 'all'
        ? inTab.length
        : by === 'answered'
          ? inTab.filter((chat) => answered(chat, defaultBotId)).length
          : (byCounts.get(by) ?? 0),
    answeredCount: chats.filter((chat) => answered(chat, defaultBotId)).length,
  };
}
