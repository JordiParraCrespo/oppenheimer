import { type BotTurnRequest, FakeBotEngine } from '@oppenheimer/backend-agents';
import { None, Some } from 'oxide.ts';
import type { BotCompletionResolver } from '../../../application/bot-completion.resolver';
import type { BotConversationSummaryRepositoryPort } from '../../../database/bot-conversation-summary.repository.port';
import type { BotMessageRepositoryPort } from '../../../database/bot-message.repository.port';
import { BotConversationSummaryEntity } from '../../../domain/bot-conversation-summary.entity';
import { BotMessageEntity } from '../../../domain/bot-message.entity';
import { BOT_SUMMARIZER_PROMPT } from '../../../domain/bot-summary.policy';
import { SummarizeBotConversationCommand } from '../summarize-bot-conversation.command';
import { SummarizeBotConversationCommandHandler } from '../summarize-bot-conversation.command-handler';

/**
 * One summarizing job: it folds the oldest uncovered messages with the bot's
 * own provider, model and key and no tools, stores the result conditioned
 * on the version it read, and on losing that race writes nothing more. It
 * decides again on what it reads, so a job with nothing to fold calls no
 * model, and a bot with no key is left alone. The write's SQL is the
 * integration spec's.
 */
let clock = Date.parse('2026-10-15T09:00:00Z');
function stored(content: string, role: 'user' | 'assistant' = 'user'): BotMessageEntity {
  clock += 1_000;
  return BotMessageEntity.create({
    id: `m-${clock}`,
    createdAt: new Date(clock),
    props: {
      organizationId: 'org-1',
      botId: 'bot-1',
      turnId: 'turn-1',
      role,
      content,
      steps: [],
      position: 0,
    },
  });
}
/** Forty messages of about a thousand tokens each: past the trigger. */
const long = () =>
  Array.from({ length: 40 }, (_, index) =>
    stored('x'.repeat(4_000), index % 2 ? 'assistant' : 'user'),
  );

function setup(
  options: {
    uncovered?: BotMessageEntity[];
    summary?: BotConversationSummaryEntity | null;
    wins?: boolean;
    target?: boolean;
    answer?: string;
  } = {},
) {
  const requests: BotTurnRequest[] = [];
  const engine = new FakeBotEngine((request) => {
    requests.push(request);
    return [{ type: 'text.done', text: options.answer ?? 'The person ships on Fridays.' }];
  });
  const complete = vi.spyOn(engine, 'complete');
  const summaries = {
    findForBot: vi.fn(async () => (options.summary ? Some(options.summary) : None)),
    save: vi.fn(async (summary: BotConversationSummaryEntity) => {
      if (options.wins === false) return false;
      summary.markPersisted();
      return true;
    }),
    stageSummarize: vi.fn(async () => undefined),
  } satisfies BotConversationSummaryRepositoryPort;
  const messages = {
    findUncovered: vi.fn(async () => options.uncovered ?? long()),
  } satisfies Pick<BotMessageRepositoryPort, 'findUncovered'>;
  const targets = {
    resolve: vi.fn(async () =>
      options.target === false
        ? null
        : { provider: 'glm' as const, model: 'glm-5.3', apiKey: 'workspace-key' },
    ),
  } satisfies Pick<BotCompletionResolver, 'resolve'>;
  const handler = new SummarizeBotConversationCommandHandler(
    summaries,
    messages as unknown as BotMessageRepositoryPort,
    engine,
    targets as unknown as BotCompletionResolver,
  );
  const run = () =>
    handler.execute(
      new SummarizeBotConversationCommand({ organizationId: 'org-1', botId: 'bot-1' }),
    );
  return { run, summaries, messages, requests, complete };
}

describe('SummarizeBotConversationCommandHandler', () => {
  it('writes a first summary of the oldest messages with the bot’s model, key and no tools', async () => {
    const uncovered = long();
    const { run, summaries, requests } = setup({ uncovered });
    await run();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      provider: 'glm',
      model: 'glm-5.3',
      apiKey: 'workspace-key',
      systemPrompt: BOT_SUMMARIZER_PROMPT,
      tools: [],
      history: [],
      engineTools: false,
    });
    expect(requests[0].message).toContain('<summary_so_far>\n(none yet)\n</summary_so_far>');
    const [written] = summaries.save.mock.calls[0];
    expect(written).toMatchObject({
      content: 'The person ships on Fridays.',
      coversThroughMessageId: uncovered[27].id,
    });
    expect(summaries.stageSummarize).not.toHaveBeenCalled();
  });

  it('revises the summary it read, folding the old one into the new', async () => {
    const summary = BotConversationSummaryEntity.create({
      id: 'bot-1',
      props: {
        organizationId: 'org-1',
        botId: 'bot-1',
        content: 'Staging is devbox.',
        coversThroughMessageId: 'm-0',
        coversThroughCreatedAt: new Date('2026-10-01T00:00:00Z'),
        version: 3,
      },
    });
    const uncovered = long();
    const { run, summaries, messages, requests } = setup({ summary, uncovered });
    await run();
    expect(messages.findUncovered).toHaveBeenCalledWith(
      'org-1',
      'bot-1',
      'm-0',
      expect.any(Number),
    );
    expect(requests[0].message).toContain(
      '<summary_so_far>\nStaging is devbox.\n</summary_so_far>',
    );
    expect(summaries.save).toHaveBeenCalledWith(summary);
    expect(summary).toMatchObject({
      versionAtLoad: 4,
      coversThroughMessageId: uncovered[27].id,
    });
  });

  it('writes nothing more when another job stored a summary first', async () => {
    const { run, summaries } = setup({ wins: false });
    await run();
    expect(summaries.save).toHaveBeenCalledTimes(1);
    expect(summaries.stageSummarize).not.toHaveBeenCalled();
  });

  it('calls no model and writes nothing when there is nothing to fold', async () => {
    const { run, summaries, complete } = setup({ uncovered: [stored('Hi'), stored('Hello')] });
    await run();
    expect(complete).not.toHaveBeenCalled();
    expect(summaries.save).not.toHaveBeenCalled();
  });

  it('leaves a bot that is gone, or has no key, as it is', async () => {
    const { run, summaries, messages, complete } = setup({ target: false });
    await run();
    expect(messages.findUncovered).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    expect(summaries.save).not.toHaveBeenCalled();
  });

  it('throws on an empty answer, so the queue retries, and writes nothing', async () => {
    const { run, summaries } = setup({ answer: '   ' });
    await expect(run()).rejects.toThrow('came back empty');
    expect(summaries.save).not.toHaveBeenCalled();
  });

  it('stages the next fold when the conversation is still past the threshold', async () => {
    const uncovered = Array.from({ length: 100 }, () => stored('x'.repeat(4_000)));
    const { run, summaries } = setup({ uncovered });
    await run();
    expect(summaries.save).toHaveBeenCalledTimes(1);
    expect(summaries.stageSummarize).toHaveBeenCalledWith('org-1', 'bot-1', expect.any(String));
  });
});
