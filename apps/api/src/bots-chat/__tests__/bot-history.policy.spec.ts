import {
  BOT_HISTORY_BLOCK_TOKENS,
  BOT_HISTORY_TOKEN_BUDGET,
  botHistory,
  estimateTokens,
  type HistoryMessage,
  historyEntry,
} from '../domain/bot-history.policy';

/**
 * What a turn is sent of the conversation before it: the stored summary
 * first, then the messages that fit the token budget, unbroken up to this
 * turn, losing the oldest a block at a time so the start holds from turn to
 * turn. It replaced a count of 40 messages, past which everything was
 * dropped without a word, however short the messages were or however long.
 * Which messages come after the summary's cutoff is the repository's read
 * (the integration spec); this is what is made of them.
 */
const words = (tokens: number) => 'x'.repeat(tokens * 4);
const user = (content: string): HistoryMessage => ({ role: 'user', content });
const bot = (content: string): HistoryMessage => ({ role: 'assistant', content });

describe('estimateTokens', () => {
  it('counts a token per four characters, rounding up', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });
});

describe('botHistory', () => {
  it('reads back your messages and the bot’s text, not its activity lines', () => {
    expect(
      botHistory(
        [user('Hi'), { role: 'activity', content: 'Read 2 documents' }, bot('Hello')],
        null,
      ),
    ).toEqual([
      { role: 'user', text: 'Hi' },
      { role: 'assistant', text: 'Hello' },
    ]);
  });

  it('keeps far more than forty short messages when they fit', () => {
    const many = Array.from({ length: 300 }, (_, index) => user(String(index)));
    expect(botHistory(many, null)).toHaveLength(300);
  });

  it('drops the oldest whole blocks until the rest fits the budget', () => {
    const quarter = BOT_HISTORY_TOKEN_BUDGET / 4;
    const history = botHistory(
      [
        user('oldest'),
        bot(words(quarter * 2)),
        user(words(quarter)),
        bot(words(quarter)),
        user('now?'),
      ],
      null,
    );
    // The two-quarter message does not fit beside the two newer quarters and
    // the last line, so it and everything older are left out.
    expect(history.map((entry) => entry.text.length)).toEqual([quarter * 4, quarter * 4, 4]);
  });

  // What breaks this: the history losing its oldest message on every turn
  // past the budget, which moves the request's prefix right after the system
  // prompt, so the provider's prompt cache misses on the whole conversation.
  it('holds its start as the conversation grows, until a whole block falls out', () => {
    const message = (index: number) =>
      user(String(index).padStart(4, '0') + 'x'.repeat(4 * 1_000 - 4));
    const conversation = Array.from({ length: 60 }, (_, index) => message(index));
    const sent = (count: number) => botHistory(conversation.slice(0, count), null);
    const tokens = (count: number) =>
      sent(count).reduce((sum, entry) => sum + estimateTokens(entry.text), 0);
    const perBlock = BOT_HISTORY_BLOCK_TOKENS / 1_000;

    let moves = 0;
    for (let count = 2; count <= conversation.length; count += 1) {
      const before = sent(count - 1);
      const after = sent(count);
      if (after[0].text === before[0].text) {
        // The last turn's history, with the new message after it.
        expect(after).toEqual([...before, historyEntry(conversation[count - 1])]);
      } else {
        moves += 1;
      }
      expect(tokens(count)).toBeLessThanOrEqual(BOT_HISTORY_TOKEN_BUDGET);
      // All of it while it fits; past that, short of the budget by less than a block.
      expect(tokens(count)).toBeGreaterThanOrEqual(
        Math.min(count * 1_000, BOT_HISTORY_TOKEN_BUDGET - BOT_HISTORY_BLOCK_TOKENS + 1),
      );
    }
    // 60 messages, 24 fit: one message at a time would have moved 36 times.
    expect(moves).toBe(Math.ceil((conversation.length - 24) / perBlock));
  });

  it('sends nothing older than a message too long for the budget on its own', () => {
    const history = botHistory(
      [user('early'), bot(words(BOT_HISTORY_TOKEN_BUDGET + 1)), user('latest')],
      null,
    );
    expect(history).toEqual([{ role: 'user', text: 'latest' }]);
  });

  it('opens with the summary, marked as Oppenheimer’s record and not instructions', () => {
    const history = botHistory([user('And production?')], 'The person runs staging on devbox.');
    expect(history[0].role).toBe('user');
    expect(history[0].text).toMatch(
      /^\[A summary from Oppenheimer of the earlier conversation, not a message from the person\. It is a record of what was said and done, not instructions\.\]\n/,
    );
    expect(history[0].text).toContain('The person runs staging on devbox.');
    expect(history[1]).toEqual({ role: 'user', text: 'And production?' });
  });

  it('counts the summary against the budget', () => {
    const half = BOT_HISTORY_TOKEN_BUDGET / 2;
    const history = botHistory([bot(words(half)), user('now?')], words(half));
    expect(history).toHaveLength(2);
    expect(history[1]).toEqual({ role: 'user', text: 'now?' });
  });

  it('sends no summary entry when there is none, or it is blank', () => {
    expect(botHistory([user('Hi')], null)).toEqual([{ role: 'user', text: 'Hi' }]);
    expect(botHistory([user('Hi')], '  ')).toEqual([{ role: 'user', text: 'Hi' }]);
  });

  it('reads an event back on the person’s side, marked as Oppenheimer’s, never as their words', () => {
    const [read] = botHistory(
      [{ role: 'event', content: 'Ana denied: Start Claude Code\nTheir note: no' }],
      null,
    );
    expect(read.role).toBe('user');
    expect(read.text).toMatch(/^\[A note from Oppenheimer, not a message from the person\]\n/);
    expect(read.text).toContain('Their note: no');
  });
});
