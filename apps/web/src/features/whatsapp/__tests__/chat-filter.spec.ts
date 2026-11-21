import { WhatsappChatGrantEntity, WhatsappChatRouteEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import {
  answerOf,
  answerValue,
  CHATS_PAGE_SIZE,
  filterChats,
} from '@/features/whatsapp/lib/chat-filter';

/**
 * A number's chats page narrows the whole list the API answers: the tab, the
 * words, who answers and the page, with counts that say what each choice
 * would leave. "Answered" counts the default only while the number has one.
 */
function chat(chatId: string, name: string, botId?: string | null) {
  const grant =
    botId === undefined
      ? null
      : new WhatsappChatGrantEntity(
          'g',
          'acc',
          chatId,
          chatId.endsWith('@g.us') ? 'group' : 'direct',
          name,
          botId,
          null,
          new Date(),
        );
  return new WhatsappChatRouteEntity(
    'acc',
    chatId,
    chatId.endsWith('@g.us') ? 'group' : 'direct',
    name,
    1,
    new Date('2026-11-20T10:00:00Z'),
    grant,
  );
}

const chats = [
  chat('1@g.us', 'Family', 'shop'),
  chat('2@g.us', 'Padel', null),
  chat('3@g.us', 'Old office'),
  chat('34600111333@s.whatsapp.net', 'Marta', null),
  chat('34600111444@s.whatsapp.net', 'Pau'),
];

describe('filterChats', () => {
  // Breaks if a tab shows the other kind, a count says something picking it
  // would not leave, or "Answered" counts the default with no default set.
  it('narrows by tab, words and who answers, counting what each choice leaves', () => {
    const groups = filterChats(chats, { tab: 'group', query: '', by: 'all', page: 1 }, 'juno');
    expect(groups.rows.map((row) => row.title)).toEqual(['Family', 'Padel', 'Old office']);
    expect(groups.tabCounts).toEqual({ group: 3, person: 2 });
    expect([groups.byCount('answered'), groups.byCount('none'), groups.byCount('shop')]).toEqual([
      2, 1, 1,
    ]);
    expect(groups.answeredCount).toBe(3);

    const noDefault = filterChats(
      chats,
      { tab: 'group', query: '', by: 'answered', page: 1 },
      null,
    );
    expect(noDefault.rows.map((row) => row.title)).toEqual(['Family']);

    const worded = filterChats(
      chats,
      { tab: 'person', query: '111333', by: 'all', page: 1 },
      'juno',
    );
    expect(worded.rows.map((row) => row.title)).toEqual(['Marta']);
  });

  // Breaks if a page past the end shows nothing instead of the last page.
  it('pages the narrowed chats, holding a page past the end to the last', () => {
    const many = Array.from({ length: CHATS_PAGE_SIZE + 3 }, (_, at) =>
      chat(`${at}@g.us`, `G${at}`),
    );
    const last = filterChats(many, { tab: 'group', query: '', by: 'all', page: 9 }, null);
    expect([last.page, last.pages, last.rows.length]).toEqual([2, 2, 3]);
  });

  it('reads a picker’s value back as the answer it names', () => {
    expect(answerOf(answerValue({ kind: 'bot', botId: 'shop' }))).toEqual({
      kind: 'bot',
      botId: 'shop',
    });
    expect(answerOf('none')).toEqual({ kind: 'none' });
    expect(answerOf('default')).toEqual({ kind: 'default' });
  });
});
