import { None, Some } from 'oxide.ts';
import type { BotConversationSummaryRepositoryPort } from '../../database/bot-conversation-summary.repository.port';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import { BotConversationSummaryEntity } from '../../domain/bot-conversation-summary.entity';
import type { SummarizableMessage } from '../../domain/bot-summary.policy';
import { BotTurnEntity } from '../../domain/bot-turn.entity';
import { BotSummaryTriggerPolicy } from '../bot-summary-trigger.policy';

/**
 * After a turn ends: the messages after the summary's cutoff are read, and a
 * summarizing job is staged only when they are past the threshold
 * (`planSummary`, whose whole table is the domain spec). A failure here never
 * reaches the turn, which has already ended.
 */
let clock = Date.parse('2026-10-15T09:00:00Z');
function stored(tokens: number, turnEnded = true): SummarizableMessage {
  clock += 1_000;
  return {
    id: `m-${clock}`,
    createdAt: new Date(clock),
    role: 'user',
    content: 'x'.repeat(tokens * 4),
    turnEnded,
  };
}

function setup(
  uncovered: SummarizableMessage[] | Error,
  summary: BotConversationSummaryEntity | null = null,
) {
  const summaries = {
    findForBot: vi.fn(async () => (summary ? Some(summary) : None)),
    stageSummarize: vi.fn(async () => undefined),
  } satisfies Pick<BotConversationSummaryRepositoryPort, 'findForBot' | 'stageSummarize'>;
  const messages = {
    findUncovered: vi.fn(async () => {
      if (uncovered instanceof Error) throw uncovered;
      return uncovered;
    }),
  } satisfies Pick<BotMessageRepositoryPort, 'findUncovered'>;
  const policy = new BotSummaryTriggerPolicy(
    messages as unknown as BotMessageRepositoryPort,
    summaries as unknown as BotConversationSummaryRepositoryPort,
  );
  const turn = BotTurnEntity.queue({
    organizationId: 'org-1',
    botId: 'bot-1',
    requestedByUserId: 'user-1',
    provider: 'glm',
    model: 'glm-5.3',
    effort: null,
  });
  return { afterTurn: () => policy.afterTurn(turn, 'corr-1'), summaries, messages };
}

describe('BotSummaryTriggerPolicy', () => {
  it('stages a summarizing job when the uncovered messages are past the threshold', async () => {
    const { afterTurn, summaries } = setup(Array.from({ length: 40 }, () => stored(1_000)));
    expect(await afterTurn()).toBe(true);
    expect(summaries.stageSummarize).toHaveBeenCalledWith('org-1', 'bot-1', 'corr-1');
  });

  it('stages nothing when what is past the threshold waits behind a turn that has not ended', async () => {
    const { afterTurn, summaries } = setup([
      stored(1_000),
      stored(1_000, false),
      ...Array.from({ length: 40 }, () => stored(1_000)),
    ]);
    expect(await afterTurn()).toBe(false);
    expect(summaries.stageSummarize).not.toHaveBeenCalled();
  });

  it('stages nothing below it', async () => {
    const { afterTurn, summaries } = setup([stored(100), stored(100)]);
    expect(await afterTurn()).toBe(false);
    expect(summaries.stageSummarize).not.toHaveBeenCalled();
  });

  it('reads only what the summary does not cover', async () => {
    const summary = BotConversationSummaryEntity.first({
      organizationId: 'org-1',
      botId: 'bot-1',
      content: 'Earlier.',
      through: { id: 'm-cut', createdAt: new Date('2026-10-01T00:00:00Z') },
    });
    const { afterTurn, messages } = setup([], summary);
    await afterTurn();
    expect(messages.findUncovered).toHaveBeenCalledWith(
      'org-1',
      'bot-1',
      'm-cut',
      expect.any(Number),
    );
  });

  it('swallows a failure: the turn has ended, and the next one asks again', async () => {
    const { afterTurn, summaries } = setup(new Error('connection lost'));
    expect(await afterTurn()).toBe(false);
    expect(summaries.stageSummarize).not.toHaveBeenCalled();
  });
});
