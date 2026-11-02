/**
 * A bot's tool-less call and what it spent (`25-bots.md` §4.1, `/usage`).
 * What breaks this: a goal review or a summary spending on the owner's key
 * without it reaching `/usage`; a call whose provider said nothing recorded
 * as one that spent nothing; a record that fails taking the call's answer
 * down with it.
 */
import { FakeBotEngine } from '@oppenheimer/backend-agents';
import type { BotUsageRepositoryPort } from '../../database/bot-usage.repository.port';
import { BotCompletionResolver } from '../bot-completion.resolver';

const REQUEST = {
  provider: 'anthropic' as const,
  apiKey: 'key',
  model: 'model-placeholder',
  systemPrompt: 'Judge.',
  message: 'Is it met?',
  signal: new AbortController().signal,
};
const CALL = { organizationId: 'org-1', botId: 'bot-1', purpose: 'goal_review' as const };

function setup(reports: boolean, fails = false) {
  const engine = new FakeBotEngine(() => [
    { type: 'text.done', text: '{"verdict":"met"}' },
    ...(reports
      ? [
          {
            type: 'usage' as const,
            inputTokens: 900,
            outputTokens: 20,
            cacheReadTokens: 800,
            cacheWriteTokens: 50,
          },
        ]
      : []),
  ]);
  const usage = {
    recordCall: vi.fn<BotUsageRepositoryPort['recordCall']>(async () => {
      if (fails) throw new Error('database down');
    }),
    findForBot: vi.fn<BotUsageRepositoryPort['findForBot']>(),
  };
  return { resolver: new BotCompletionResolver(engine, usage), usage };
}

describe('BotCompletionResolver', () => {
  it('answers the text and records what the call spent against the bot, for its purpose', async () => {
    const { resolver, usage } = setup(true);
    expect(await resolver.complete(REQUEST, CALL)).toBe('{"verdict":"met"}');
    expect(usage.recordCall).toHaveBeenCalledWith({
      ...CALL,
      provider: 'anthropic',
      model: 'model-placeholder',
      inputTokens: 900,
      outputTokens: 20,
      cacheReadTokens: 800,
      cacheWriteTokens: 50,
    });
  });

  it('records nothing when the provider said nothing about what it spent', async () => {
    const { resolver, usage } = setup(false);
    await resolver.complete(REQUEST, CALL);
    expect(usage.recordCall).not.toHaveBeenCalled();
  });

  it('keeps the answer when the record fails', async () => {
    const { resolver } = setup(true, true);
    expect(await resolver.complete(REQUEST, CALL)).toBe('{"verdict":"met"}');
  });
});
