import { type BotTurnRequest, FakeBotEngine } from '@oppenheimer/backend-agents';
import type { CacheService } from '@oppenheimer/backend-cache';
import { BOT_SUGGESTER_PROMPT, type SuggestionMessage } from '../../domain/bot-suggestion.policy';
import { BotCompletionResolver } from '../bot-completion.resolver';
import type { BotModelAccessResolver } from '../bot-model-access.resolver';
import { BotSuggestionResolver } from '../bot-suggestion.resolver';

/**
 * Where a suggestion spends: the bot's own model, with no tools, once per
 * message of the bot's it answers (the cache), its spend recorded as
 * `suggestion`; none with no key, NONE or a failure, and a failure is not
 * kept. Which message it answers, and when it is asked at all, is the query
 * handler's spec; what is sent and shown is the policy's.
 */
const recent: SuggestionMessage[] = [
  { id: 'm-1', role: 'user', content: 'run the tests' },
  { id: 'm-2', role: 'assistant', content: 'All green. Open the pull request?' },
];
const bot = { organizationId: 'org-1', id: 'bot-1' };

function setup(options: { target?: boolean; answer?: string; fails?: boolean } = {}) {
  const requests: BotTurnRequest[] = [];
  const engine = new FakeBotEngine((request) => {
    requests.push(request);
    if (options.fails) return [{ type: 'done', reason: 'failed', error: 'upstream down' }];
    return [{ type: 'text.done', text: options.answer ?? 'yes, open the pull request' }];
  });
  const recordCall = vi.fn(async () => undefined);
  const kept = new Map<string, unknown>();
  const cache = {
    getOrSet: async <T>(key: string, _ttl: number, load: () => Promise<T>): Promise<T> => {
      if (!kept.has(key)) kept.set(key, await load());
      return kept.get(key) as T;
    },
  } satisfies Pick<CacheService, 'getOrSet'>;
  const access = {
    ownModel: vi.fn(async () =>
      options.target === false
        ? null
        : { provider: 'glm' as const, model: 'glm-5.3', apiKey: 'workspace-key' },
    ),
  } satisfies Pick<BotModelAccessResolver, 'ownModel'>;
  const resolver = new BotSuggestionResolver(
    access as unknown as BotModelAccessResolver,
    new BotCompletionResolver(engine, { recordCall, findForBot: vi.fn() }),
    cache as unknown as CacheService,
  );
  const suggest = () => resolver.suggest(bot, recent, recent[1]);
  return { suggest, requests, kept, recordCall };
}

describe('BotSuggestionResolver', () => {
  it('asks the bot’s own model, with no tools, and records the spend as a suggestion', async () => {
    const { suggest, requests, recordCall } = setup();
    await expect(suggest()).resolves.toBe('yes, open the pull request');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      provider: 'glm',
      model: 'glm-5.3',
      apiKey: 'workspace-key',
      systemPrompt: BOT_SUGGESTER_PROMPT,
      tools: [],
    });
    expect(requests[0].message).toContain('All green. Open the pull request?');
    expect(recordCall.mock.calls.every(([call]) => call.purpose === 'suggestion')).toBe(true);
  });

  it('asks once per message of the bot’s, however often the composer reads it', async () => {
    const { suggest, requests, kept } = setup();
    await suggest();
    await expect(suggest()).resolves.toBe('yes, open the pull request');
    expect(requests).toHaveLength(1);
    expect([...kept.keys()]).toEqual(['bot-suggestion:org-1:bot-1:m-2']);
  });

  it('suggests nothing, and calls no model, when the bot’s provider has no credential', async () => {
    const { suggest, requests } = setup({ target: false });
    await expect(suggest()).resolves.toBeNull();
    expect(requests).toHaveLength(0);
  });

  it('suggests nothing when the model says NONE', async () => {
    await expect(setup({ answer: 'NONE' }).suggest()).resolves.toBeNull();
  });

  it('suggests nothing when the model fails, and keeps no answer, so the next read asks again', async () => {
    const { suggest, kept } = setup({ fails: true });
    await expect(suggest()).resolves.toBeNull();
    expect(kept.size).toBe(0);
  });
});
