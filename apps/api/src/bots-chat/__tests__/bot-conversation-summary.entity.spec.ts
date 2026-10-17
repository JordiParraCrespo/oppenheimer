import { BotConversationSummaryEntity } from '../domain/bot-conversation-summary.entity';
import { BOT_SUMMARY_MAX } from '../domain/bot-summary.policy';

/**
 * A bot's conversation summary as an aggregate: a first one is not stored
 * yet (version 0, so its write is an insert), a revision only moves the
 * cutoff forward, and a won write is what the next one is conditioned on.
 * That two jobs racing leave one write standing is the integration spec's.
 */
const at = (iso: string) => new Date(iso);
function first() {
  return BotConversationSummaryEntity.first({
    organizationId: 'org-1',
    botId: 'bot-1',
    content: '  The person runs staging on devbox.  ',
    through: { id: 'm-1', createdAt: at('2026-10-15T09:00:00Z') },
  });
}

describe('BotConversationSummaryEntity', () => {
  it('starts unstored, keyed by its bot, with its content trimmed', () => {
    const summary = first();
    expect(summary.id).toBe('bot-1');
    expect(summary.versionAtLoad).toBe(0);
    expect(summary.content).toBe('The person runs staging on devbox.');
  });

  it('moves its cutoff forward on a revision, and never back', () => {
    const summary = first();
    summary.revise('More.', { id: 'm-9', createdAt: at('2026-10-15T10:00:00Z') });
    expect(summary).toMatchObject({ content: 'More.', coversThroughMessageId: 'm-9' });
    expect(() =>
      summary.revise('Older.', { id: 'm-0', createdAt: at('2026-10-15T08:00:00Z') }),
    ).toThrow('A summary only moves forward');
    expect(summary.coversThroughMessageId).toBe('m-9');
  });

  it('conditions its next write on the version the last won write stored', () => {
    const summary = first();
    summary.markPersisted();
    expect(summary.versionAtLoad).toBe(1);
    summary.markPersisted();
    expect(summary.versionAtLoad).toBe(2);
  });

  it('refuses an empty summary, and cuts a long one to what the column holds', () => {
    expect(() =>
      BotConversationSummaryEntity.first({
        organizationId: 'org-1',
        botId: 'bot-1',
        content: '   ',
        through: { id: 'm-1', createdAt: at('2026-10-15T09:00:00Z') },
      }),
    ).toThrow();
    const summary = first();
    summary.revise('z'.repeat(BOT_SUMMARY_MAX * 2), {
      id: 'm-2',
      createdAt: at('2026-10-15T09:30:00Z'),
    });
    expect(summary.content).toHaveLength(BOT_SUMMARY_MAX);
  });
});
